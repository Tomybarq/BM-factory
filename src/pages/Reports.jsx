import { useEffect, useState, useMemo } from "react";
import {
  FileBarChart,
  Printer,
  FileSpreadsheet,
  Search,
  TrendingUp,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/constants";

export default function Reports() {
  const [calcs, setCalcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Calculation.list("-created_date", 100);
        setCalcs(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const productNames = useMemo(() => {
    const set = new Set(calcs.map((c) => c.product_name).filter(Boolean));
    return Array.from(set);
  }, [calcs]);

  const filtered = useMemo(() => {
    return calcs.filter((c) => {
      const matchSearch = !search || c.product_name?.includes(search);
      const matchProduct = productFilter === "all" || c.product_name === productFilter;
      return matchSearch && matchProduct;
    });
  }, [calcs, search, productFilter]);

  // Comparison chart: avg cost per liter per product
  const comparisonData = useMemo(() => {
    const groups = {};
    filtered.forEach((c) => {
      const name = c.product_name || "—";
      if (!groups[name]) groups[name] = { name, total: 0, count: 0 };
      groups[name].total += c.cost_per_liter || 0;
      groups[name].count += 1;
    });
    return Object.values(groups).map((g) => ({
      name: g.name,
      "متوسط التكلفة/لتر": Math.round(g.total / g.count),
    }));
  }, [filtered]);

  const exportCSV = () => {
    const headers = ["المنتج", "الحجم", "تكلفة المواد", "تكلفة التعبئة", "تكاليف يدوية", "الإجمالي", "التكلفة/لتر", "التاريخ"];
    const rows = filtered.map((c) => [
      c.product_name,
      c.packaging_size,
      c.raw_material_cost,
      c.packaging_cost,
      c.manual_cost,
      c.total_cost,
      c.cost_per_liter,
      new Date(c.created_date).toLocaleDateString("ar-EG"),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "تقرير_الحسابات.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث بالمنتج..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="sm:w-52"><SelectValue placeholder="كل المنتجات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنتجات</SelectItem>
              {productNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileSpreadsheet className="ml-1 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="ml-1 h-4 w-4" /> طباعة / PDF
          </Button>
        </div>
      </div>

      {/* Comparison Chart */}
      {comparisonData.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-bold">مقارنة متوسط التكلفة لكل لتر بين المنتجات</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "Cairo" }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12, fontFamily: "Cairo" }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontFamily: "Cairo",
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontFamily: "Cairo", fontSize: 12 }} />
              <Bar dataKey="متوسط التكلفة/لتر" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-right">
                  <th className="px-4 py-3 font-semibold">المنتج</th>
                  <th className="px-4 py-3 font-semibold">الحجم</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">المواد الخام</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">التعبئة</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">يدوية</th>
                  <th className="px-4 py-3 font-semibold">الإجمالي</th>
                  <th className="px-4 py-3 font-semibold">التكلفة/لتر</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">جارٍ التحميل...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted-foreground">
                      <FileBarChart className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      لا توجد حسابات محفوظة
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{c.product_name}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{c.packaging_size}</Badge></td>
                      <td className="hidden px-4 py-3 md:table-cell">{formatCurrency(c.raw_material_cost)}</td>
                      <td className="hidden px-4 py-3 md:table-cell">{formatCurrency(c.packaging_cost)}</td>
                      <td className="hidden px-4 py-3 lg:table-cell">{formatCurrency(c.manual_cost)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(c.total_cost)}</td>
                      <td className="px-4 py-3 font-bold text-primary">{formatCurrency(c.cost_per_liter)}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {new Date(c.created_date).toLocaleDateString("ar-EG")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}