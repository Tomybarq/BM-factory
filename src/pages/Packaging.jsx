import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { can, formatCurrency, PACKAGING_SIZES } from "@/lib/constants";
import { calcPackagingCost, packagingFieldLabels } from "@/lib/calculations";

const FIELDS = packagingFieldLabels();

export default function Packaging() {
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const { role } = useCurrentUser();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.PackagingCost.list();
      const map = {};
      PACKAGING_SIZES.forEach((s) => {
        const rec = data.find((d) => d.size === s);
        map[s] = rec || { size: s, bottle_cost: 0, cap_cost: 0, label_cost: 0, carton_cost: 0, operational_cost: 0, transportation_cost: 0, miscellaneous_cost: 0 };
      });
      setRecords(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (size, key, value) => {
    setRecords((prev) => ({
      ...prev,
      [size]: { ...prev[size], [key]: Number(value) || 0 },
    }));
  };

  const handleSave = async (size) => {
    const rec = records[size];
    setSaving(size);
    try {
      if (rec.id) {
        await base44.entities.PackagingCost.update(rec.id, rec);
      } else {
        await base44.entities.PackagingCost.create(rec);
      }
      toast({ title: `تم حفظ تكاليف ${size}` });
      load();
    } catch (e) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3">
        <Package className="h-5 w-5 text-primary" />
        <p className="text-sm font-medium">أدخل تكاليف التعبئة لكل حجم. يتم احتساب الإجمالي تلقائياً.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PACKAGING_SIZES.map((size, idx) => {
          const rec = records[size] || {};
          const subtotal = calcPackagingCost(rec);
          return (
            <motion.div
              key={size}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-l from-primary to-primary/80 px-5 py-4 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{size}</h3>
                    <div className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur">
                      {formatCurrency(subtotal)}
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-primary-foreground/80">الإجمالي</p>
                </div>
                <CardContent className="space-y-3 p-4">
                  {FIELDS.map((f) => (
                    <div key={f.key} className="grid grid-cols-2 items-center gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                      <Input
                        type="number"
                        min="0"
                        disabled={!can(role, "update")}
                        value={rec[f.key] ?? 0}
                        onChange={(e) => updateField(size, f.key, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                  {can(role, "update") && (
                    <Button
                      className="mt-2 w-full"
                      size="sm"
                      onClick={() => handleSave(size)}
                      disabled={saving === size}
                    >
                      <Save className="ml-1 h-4 w-4" />
                      {saving === size ? "جارٍ الحفظ..." : "حفظ"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}