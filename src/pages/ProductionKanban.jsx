import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Trash2, Package, GripVertical } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/api/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { can, PACKAGING_SIZES } from "@/lib/constants";

const COLUMNS = [
  { id: "preparing", title: "التحضير", color: "bg-amber-500" },
  { id: "packaging", title: "التعبئة", color: "bg-primary" },
  { id: "shipping", title: "الشحن", color: "bg-violet-500" },
  { id: "done", title: "مكتمل", color: "bg-emerald-500" },
];

const PRIORITY = {
  high: { label: "عالية", className: "bg-destructive/15 text-destructive" },
  medium: { label: "متوسطة", className: "bg-amber-500/15 text-amber-600 dark:text-amber-500" },
  low: { label: "منخفضة", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-500" },
};

const emptyForm = { product_name: "", packaging_size: "5 لتر", quantity: 1, priority: "medium", notes: "", due_date: "" };

export default function ProductionKanban() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const { role } = useCurrentUser();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [ords, prods] = await Promise.all([
        base44.entities.ProductionOrder.list("-updated_date"),
        base44.entities.Product.list(),
      ]);
      setOrders(ords);
      setProducts(prods);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // Subscribe to realtime updates on ProductionOrder table
    const channel = supabase
      .channel("realtime-production-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ProductionOrder" },
        (payload) => {
          console.log("Realtime order update:", payload);
          if (payload.eventType === "INSERT") {
            setOrders((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) => prev.map((o) => (o.id === payload.new.id ? payload.new : o)));
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const ordersByStatus = (status) => orders.filter((o) => o.status === status);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const order = orders.find((o) => o.id === draggableId);
    if (!order) return;

    const newStatus = destination.droppableId;
    // Optimistic update
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o)));

    try {
      await base44.entities.ProductionOrder.update(order.id, { status: newStatus });
      const col = COLUMNS.find((c) => c.id === newStatus);
      toast({ title: `تم نقل الطلب إلى "${col.title}"` });
    } catch (e) {
      // Revert on failure
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: source.droppableId } : o)));
      toast({ title: "فشل نقل الطلب", description: e.message, variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    if (!form.product_name.trim()) return toast({ title: "أدخل اسم المنتج", variant: "destructive" });
    if (Number(form.quantity) <= 0) return toast({ title: "الكمية يجب أن تكون موجبة", variant: "destructive" });
    const count = orders.length + 1;
    const payload = {
      order_number: `ORD-${String(count).padStart(4, "0")}`,
      product_name: form.product_name.trim(),
      product_id: products.find((p) => p.name === form.product_name)?.id || "",
      packaging_size: form.packaging_size,
      quantity: Number(form.quantity),
      priority: form.priority,
      notes: form.notes.trim(),
      due_date: form.due_date || undefined,
      status: "preparing",
    };
    await base44.entities.ProductionOrder.create(payload);
    toast({ title: "تم إنشاء طلب الإنتاج" });
    setDialogOpen(false);
    setForm(emptyForm);
    load();
  };

  const handleDelete = async (order) => {
    if (!confirm(`حذف طلب "${order.product_name}"؟`)) return;
    await base44.entities.ProductionOrder.delete(order.id);
    toast({ title: "تم الحذف" });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">اسحب الطلبات بين المراحل لمتابعة حالة الإنتاج</p>
        {can(role, "create") && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="ml-1 h-4 w-4" /> طلب إنتاج جديد
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const colOrders = ordersByStatus(col.id);
              return (
                <div key={col.id} className="flex flex-col rounded-2xl bg-muted/30">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                      <h3 className="font-bold text-sm">{col.title}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs">{colOrders.length}</Badge>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-2.5 rounded-b-2xl p-3 transition-colors min-h-[200px] ${
                          snapshot.isDraggingOver ? "bg-primary/5" : ""
                        }`}
                      >
                        {colOrders.length === 0 && (
                          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                            <Package className="ml-1 h-4 w-4 opacity-40" /> لا توجد طلبات
                          </div>
                        )}
                        {colOrders.map((order, idx) => (
                          <Draggable key={order.id} draggableId={order.id} index={idx}>
                            {(p, s) => (
                              <div
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...p.dragHandleProps}
                              >
                                <motion.div
                                  initial={false}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`group rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
                                    s.isDragging ? "shadow-lg ring-2 ring-primary/40" : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold truncate">{order.product_name}</p>
                                      <p className="text-[11px] text-muted-foreground">{order.order_number}</p>
                                    </div>
                                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab" />
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[11px]">
                                      {order.quantity} × {order.packaging_size}
                                    </Badge>
                                    <Badge className={`text-[11px] ${PRIORITY[order.priority].className}`} variant="outline">
                                      {PRIORITY[order.priority].label}
                                    </Badge>
                                  </div>
                                  {order.due_date && (
                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                      الاستلام: {new Date(order.due_date).toLocaleDateString("ar-EG")}
                                    </p>
                                  )}
                                  {can(role, "delete") && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="mt-1 h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                                      onClick={() => handleDelete(order)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </motion.div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Add Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>طلب إنتاج جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>المنتج *</Label>
              <Select value={form.product_name} onValueChange={(v) => setForm({ ...form, product_name: v })}>
                <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>حجم العبوة</Label>
                <Select value={form.packaging_size} onValueChange={(v) => setForm({ ...form, packaging_size: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PACKAGING_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>الكمية</Label>
                <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="low">منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>تاريخ الاستلام</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleAdd}>إنشاء الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}