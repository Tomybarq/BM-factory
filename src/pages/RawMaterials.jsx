import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, Boxes, History, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { UNITS, can, formatCurrency } from "@/lib/constants";

const emptyForm = { name: "", category: "", unit: "كجم", purchase_price: "", supplier: "", notes: "" };

export default function RawMaterials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [historyItem, setHistoryItem] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const { role } = useCurrentUser();
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncMaterialPrices", {});
      toast({ title: `تم تحديث ${res.data.updated} مادة من جوجل شيتس` });
      load();
    } catch (e) {
      toast({
        title: "فشلت المزامنة",
        description: e.response?.data?.error || e.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.RawMaterial.list("-updated_date");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return ["all", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((m) => {
      const matchSearch =
        !search ||
        m.name?.includes(search) ||
        m.supplier?.includes(search) ||
        m.category?.includes(search);
      const matchCat = categoryFilter === "all" || m.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [items, search, categoryFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item, purchase_price: item.purchase_price ?? "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast({ title: "أدخل اسم المادة", variant: "destructive" });
    if (Number(form.purchase_price) < 0) return toast({ title: "السعر لا يمكن أن يكون سالباً", variant: "destructive" });

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit,
      purchase_price: Number(form.purchase_price) || 0,
      supplier: form.supplier.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (editing) {
        const history = editing.price_history || [];
        if (editing.purchase_price !== payload.purchase_price) {
          history.push({ price: editing.purchase_price, date: new Date().toISOString() });
        }
        await base44.entities.RawMaterial.update(editing.id, { ...payload, price_history: history });
        toast({ title: "تم تحديث المادة بنجاح" });
      } else {
        await base44.entities.RawMaterial.create(payload);
        toast({ title: "تمت إضافة المادة بنجاح" });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: "حدث خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`حذف المادة "${item.name}"؟`)) return;
    await base44.entities.RawMaterial.delete(item.id);
    toast({ title: "تم الحذف" });
    load();
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو المورد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="التصنيف" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "كل التصنيفات" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {role === "admin" && (
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`ml-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "جارٍ المزامنة..." : "مزامنة من جوجل شيتس"}
            </Button>
          )}
          {can(role, "create") && (
            <Button onClick={openAdd} className="shrink-0">
              <Plus className="ml-1 h-4 w-4" />
              إضافة مادة
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-right">
                  <th className="px-4 py-3 font-semibold">المادة</th>
                  <th className="px-4 py-3 font-semibold">التصنيف</th>
                  <th className="px-4 py-3 font-semibold">الوحدة</th>
                  <th className="px-4 py-3 font-semibold">سعر الشراء</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">المورد</th>
                  <th className="px-4 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">جارٍ التحميل...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      <Boxes className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      لا توجد مواد
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-border/60 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3">
                        {m.category ? <Badge variant="secondary">{m.category}</Badge> : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.unit}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{formatCurrency(m.purchase_price)}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{m.supplier || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoryItem(m)}>
                            <History className="h-4 w-4" />
                          </Button>
                          {can(role, "update") && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {can(role, "delete") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(m)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل مادة خام" : "إضافة مادة خام"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>اسم المادة *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: حمض السلفونيك" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>التصنيف</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="مثال: مواد فعالة" />
              </div>
              <div className="grid gap-2">
                <Label>الوحدة *</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>سعر الشراء *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.purchase_price}
                  onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>المورد</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="اسم المورد" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={!!historyItem} onOpenChange={(o) => !o && setHistoryItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>سجل أسعار — {historyItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span className="text-sm font-medium">السعر الحالي</span>
              <span className="font-bold text-primary">{formatCurrency(historyItem?.purchase_price)}</span>
            </div>
            {(historyItem?.price_history || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد سجل سابق</p>
            ) : (
              (historyItem?.price_history || []).slice().reverse().map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {new Date(h.date).toLocaleDateString("ar-EG")}
                  </span>
                  <span className="font-medium">{formatCurrency(h.price)}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}