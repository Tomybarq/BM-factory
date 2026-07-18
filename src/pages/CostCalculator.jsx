import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Save, Plus, X, Droplet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { can, formatCurrency, PACKAGING_SIZES, DEFAULT_MANUAL_COSTS } from "@/lib/constants";
import {
  calcRawMaterialCost,
  calcPackagingCost,
  calcManualCost,
  calcTotal,
  calcCostPerLiter,
  packagingFieldLabels,
} from "@/lib/calculations";

const FIELDS = packagingFieldLabels();

export default function CostCalculator() {
  const [products, setProducts] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [packaging, setPackaging] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedFormula, setSelectedFormula] = useState("");
  const [manualCosts, setManualCosts] = useState([]);
  const [saving, setSaving] = useState(false);
  const { role } = useCurrentUser();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [prods, forms, pkgs] = await Promise.all([
          base44.entities.Product.list(),
          base44.entities.ProductFormula.list("-updated_date"),
          base44.entities.PackagingCost.list(),
        ]);
        setProducts(prods);
        setFormulas(forms);
        const pkgMap = {};
        pkgs.forEach((p) => (pkgMap[p.size] = p));
        setPackaging(pkgMap);
        setManualCosts(DEFAULT_MANUAL_COSTS.map((c) => ({ ...c, amount: 0 })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const productFormulas = formulas.filter((f) => f.product_id === selectedProduct);
  const formula = formulas.find((f) => f.id === selectedFormula);

  const rmCost = calcRawMaterialCost(formula?.ingredients || []);
  const manualTotal = calcManualCost(manualCosts);

  const results = PACKAGING_SIZES.map((size) => {
    const pkg = packaging[size] || {};
    const pkgCost = calcPackagingCost(pkg);
    const total = calcTotal(rmCost, pkgCost, manualTotal);
    const perLiter = calcCostPerLiter(total, size);
    return { size, rmCost, pkgCost, manualTotal, total, perLiter };
  });

  const updateManualCost = (idx, amount) => {
    const next = [...manualCosts];
    next[idx] = { ...next[idx], amount: Number(amount) || 0 };
    setManualCosts(next);
  };

  const addCustomCost = () => {
    setManualCosts([...manualCosts, { name: "", amount: 0, category: "متفرقات" }]);
  };

  const removeManualCost = (idx) => {
    setManualCosts(manualCosts.filter((_, i) => i !== idx));
  };

  const saveCalculation = async () => {
    if (!selectedProduct || !formula) return toast({ title: "اختر المنتج والتركيبة", variant: "destructive" });
    const product = products.find((p) => p.id === selectedProduct);
    setSaving(true);
    try {
      const records = results.map((r) => ({
        product_id: selectedProduct,
        product_name: product.name,
        formula_id: selectedFormula,
        packaging_size: r.size,
        volume_liters: { "5 لتر": 5, "2 لتر": 2, "1.5 لتر": 1.5, "750 مل": 0.75 }[r.size],
        raw_material_cost: r.rmCost,
        packaging_cost: r.pkgCost,
        manual_cost: r.manualTotal,
        total_cost: r.total,
        cost_per_liter: r.perLiter,
        manual_costs: manualCosts.filter((c) => c.amount > 0).map((c) => ({ name: c.name, amount: c.amount })),
        ingredients_snapshot: formula.ingredients,
      }));
      await base44.entities.Calculation.bulkCreate(records);
      toast({ title: "تم حفظ الحسابات بنجاح" });
    } catch (e) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Selection */}
      <Card>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label className="font-semibold">المنتج</Label>
              <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v); setSelectedFormula(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="font-semibold">التركيبة</Label>
              <Select value={selectedFormula} onValueChange={setSelectedFormula} disabled={!selectedProduct}>
                <SelectTrigger><SelectValue placeholder="اختر التركيبة" /></SelectTrigger>
                <SelectContent>
                  {productFormulas.map((f) => (
                    <SelectItem key={f.id} value={f.id}>إصدار {f.version} — {f.ingredients?.length || 0} مادة</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formula && (
            <div className="mt-4 rounded-xl bg-primary/5 p-4">
              <p className="mb-2 text-sm font-semibold">مكونات التركيبة</p>
              <div className="flex flex-wrap gap-2">
                {formula.ingredients.map((ing, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {ing.material_name} — {ing.quantity} {ing.unit}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-medium text-muted-foreground">إجمالي تكلفة المواد الخام</span>
                <span className="font-bold text-primary">{formatCurrency(rmCost)} ريال</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Costs */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalcIcon className="h-5 w-5 text-primary" />
              <h3 className="font-bold">التكاليف الإضافية اليدوية</h3>
            </div>
            <Button size="sm" variant="outline" onClick={addCustomCost}>
              <Plus className="ml-1 h-4 w-4" /> إضافة
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {manualCosts.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2">
                <Input
                  placeholder="البند"
                  value={c.name}
                  onChange={(e) => {
                    const next = [...manualCosts];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setManualCosts(next);
                  }}
                  className="h-9 flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={c.amount}
                  onChange={(e) => updateManualCost(idx, e.target.value)}
                  className="h-9 w-24"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeManualCost(idx)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2.5">
            <span className="text-sm font-semibold">إجمالي التكاليف اليدوية</span>
            <span className="font-bold">{formatCurrency(manualTotal)} ريال</span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {formula ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">نتائج الحساب لكل أحجام التعبئة</h3>
            {can(role, "create") && (
              <Button onClick={saveCalculation} disabled={saving}>
                <Save className="ml-1 h-4 w-4" />
                {saving ? "جارٍ الحفظ..." : "حفظ الحسابات"}
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {results.map((r, idx) => (
              <motion.div
                key={r.size}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between bg-gradient-to-l from-primary to-primary/80 px-5 py-3 text-primary-foreground">
                    <div className="flex items-center gap-2">
                      <Droplet className="h-5 w-5" />
                      <h4 className="text-base font-bold">{r.size}</h4>
                    </div>
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <ResultRow label="المواد الخام" value={r.rmCost} />
                    <ResultRow label="التعبئة والتغليف" value={r.pkgCost} />
                    <ResultRow label="تكاليف يدوية" value={r.manualTotal} />
                    <div className="my-1 border-t border-border" />
                    <ResultRow label="الإجمالي" value={r.total} bold />
                    <div className="rounded-lg bg-primary/10 px-3 py-2 text-center">
                      <p className="text-[11px] text-muted-foreground">التكلفة لكل لتر</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(r.perLiter)}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <CalcIcon className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">اختر منتجاً وتركيبة لعرض نتائج الحساب</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultRow({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold text-foreground" : "font-medium"}>{formatCurrency(value)}</span>
    </div>
  );
}