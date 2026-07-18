import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  FlaskConical,
  Copy,
  ChevronLeft,
  Save,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { can, formatCurrency } from "@/lib/constants";
import { calcRawMaterialCost } from "@/lib/calculations";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDialog, setProductDialog] = useState(false);
  const [formulaDialog, setFormulaDialog] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", description: "", category: "", notes: "" });
  const [editingProduct, setEditingProduct] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const { role } = useCurrentUser();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [prods, forms, mats] = await Promise.all([
        base44.entities.Product.list("-updated_date"),
        base44.entities.ProductFormula.list("-updated_date"),
        base44.entities.RawMaterial.list(),
      ]);
      setProducts(prods);
      setFormulas(forms);
      setMaterials(mats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const productFormulas = formulas.filter((f) => f.product_id === selectedProduct?.id);

  const saveProduct = async () => {
    if (!productForm.name.trim()) return toast({ title: "أدخل اسم المنتج", variant: "destructive" });
    const payload = {
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      category: productForm.category.trim(),
      notes: productForm.notes.trim(),
    };
    if (editingProduct) {
      await base44.entities.Product.update(editingProduct.id, payload);
      toast({ title: "تم تحديث المنتج" });
    } else {
      await base44.entities.Product.create(payload);
      toast({ title: "تمت إضافة المنتج" });
    }
    setProductDialog(false);
    load();
  };

  const deleteProduct = async (p) => {
    if (!confirm(`حذف المنتج "${p.name}"؟`)) return;
    await base44.entities.Product.delete(p.id);
    if (selectedProduct?.id === p.id) setSelectedProduct(null);
    toast({ title: "تم الحذف" });
    load();
  };

  const openFormulaBuilder = (product) => {
    setSelectedProduct(product);
    setIngredients([]);
    setFormulaDialog(true);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { material_id: "", material_name: "", quantity: "", unit: "كجم", price_at_time: 0 }]);
  };

  const updateIngredient = (idx, field, value) => {
    const next = [...ingredients];
    if (field === "material_id") {
      const mat = materials.find((m) => m.id === value);
      next[idx] = {
        ...next[idx],
        material_id: value,
        material_name: mat?.name || "",
        unit: mat?.unit || "كجم",
        price_at_time: mat?.purchase_price || 0,
      };
    } else {
      next[idx] = { ...next[idx], [field]: field === "quantity" || field === "price_at_time" ? Number(value) || 0 : value };
    }
    setIngredients(next);
  };

  const removeIngredient = (idx) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const saveFormula = async () => {
    if (ingredients.length === 0) return toast({ title: "أضف مادة واحدة على الأقل", variant: "destructive" });
    if (ingredients.some((i) => !i.material_id || Number(i.quantity) <= 0)) {
      return toast({ title: "تحقق من الكميات والمواد", variant: "destructive" });
    }
    const payload = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      version: String(Number(formulas.filter((f) => f.product_id === selectedProduct.id).length) + 1) + ".0",
      ingredients: ingredients.map((i) => ({
        material_id: i.material_id,
        material_name: i.material_name,
        quantity: Number(i.quantity),
        unit: i.unit,
        price_at_time: Number(i.price_at_time) || 0,
      })),
      is_active: true,
    };
    await base44.entities.ProductFormula.create(payload);
    toast({ title: "تم حفظ التركيبة" });
    setFormulaDialog(false);
    load();
  };

  const duplicateFormula = async (f) => {
    await base44.entities.ProductFormula.create({
      ...f,
      id: undefined,
      version: String(Number(formulas.filter((x) => x.product_id === f.product_id).length) + 1) + ".0",
    });
    toast({ title: "تم نسخ التركيبة" });
    load();
  };

  const deleteFormula = async (f) => {
    if (!confirm("حذف التركيبة؟")) return;
    await base44.entities.ProductFormula.delete(f.id);
    load();
  };

  const loadFormulaToEdit = (f) => {
    setSelectedProduct(products.find((p) => p.id === f.product_id));
    setIngredients(f.ingredients || []);
    setFormulaDialog(true);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">إدارة المنتجات وتركيباتها الصناعية</p>
        {can(role, "create") && (
          <Button onClick={() => { setEditingProduct(null); setProductForm({ name: "", description: "", category: "", notes: "" }); setProductDialog(true); }}>
            <Plus className="ml-1 h-4 w-4" /> منتج جديد
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {products.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <FlaskConical className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">لا توجد منتجات بعد</p>
              {can(role, "create") && (
                <Button onClick={() => setProductDialog(true)}><Plus className="ml-1 h-4 w-4" /> إضافة منتج</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          products.map((p) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {p.category && <Badge variant="secondary" className="mt-1">{p.category}</Badge>}
                    </div>
                    <div className="flex gap-1">
                      {can(role, "update") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openFormulaBuilder(p)}>
                          <FlaskConical className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      {can(role, "update") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingProduct(p); setProductForm({ name: p.name, description: p.description || "", category: p.category || "", notes: p.notes || "" }); setProductDialog(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {can(role, "delete") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {p.description && <p className="mb-3 text-sm text-muted-foreground">{p.description}</p>}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">التركيبات ({productFormulas.length})</p>
                    {productFormulas.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70">لا توجد تركيبات</p>
                    ) : (
                      productFormulas.map((f) => (
                        <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-xs font-medium">إصدار {f.version}</span>
                            <span className="mr-2 text-xs text-muted-foreground">{f.ingredients?.length || 0} مادة</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary">{formatCurrency(calcRawMaterialCost(f.ingredients))}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => loadFormulaToEdit(f)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateFormula(f)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {can(role, "delete") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFormula(f)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Product Dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>اسم المنتج *</Label>
              <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>التصنيف</Label>
              <Input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="مثال: صابون أيدي" />
            </div>
            <div className="grid gap-2">
              <Label>الوصف</Label>
              <Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid gap-2">
              <Label>ملاحظات</Label>
              <Input value={productForm.notes} onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(false)}>إلغاء</Button>
            <Button onClick={saveProduct}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formula Builder Dialog */}
      <Dialog open={formulaDialog} onOpenChange={setFormulaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>بناء تركيبة — {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">المواد المكوّنة</p>
              <Button size="sm" variant="outline" onClick={addIngredient}>
                <Plus className="ml-1 h-4 w-4" /> إضافة مادة
              </Button>
            </div>
            <div className="max-h-[350px] space-y-2 overflow-y-auto scrollbar-thin">
              {ingredients.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">أضف مواداً للتركيبة</p>
              ) : (
                ingredients.map((ing, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-border bg-muted/20 p-2">
                    <div className="col-span-5">
                      <Select value={ing.material_id} onValueChange={(v) => updateIngredient(idx, "material_id", v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                        <SelectContent>
                          {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min="0" placeholder="الكمية" value={ing.quantity} onChange={(e) => updateIngredient(idx, "quantity", e.target.value)} className="h-9" />
                    </div>
                    <div className="col-span-2 text-center text-xs text-muted-foreground">{ing.unit}</div>
                    <div className="col-span-1 text-center text-xs font-semibold text-primary">
                      {formatCurrency((Number(ing.quantity) || 0) * (Number(ing.price_at_time) || 0))}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeIngredient(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {ingredients.length > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-2.5">
                <span className="text-sm font-semibold">إجمالي تكلفة المواد الخام</span>
                <span className="font-bold text-primary">{formatCurrency(calcRawMaterialCost(ingredients))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormulaDialog(false)}>إلغاء</Button>
            <Button onClick={saveFormula}><Save className="ml-1 h-4 w-4" /> حفظ التركيبة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}