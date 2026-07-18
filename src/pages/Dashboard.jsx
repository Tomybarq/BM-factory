import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Boxes,
  FlaskConical,
  Calculator as CalcIcon,
  TrendingUp,
  Package,
  ArrowLeft,
  Receipt,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function Dashboard() {
  const [stats, setStats] = useState({
    materials: 0,
    products: 0,
    calculations: 0,
    avgCost: 0,
  });
  const [recent, setRecent] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [materials, products, calculations] = await Promise.all([
          base44.entities.RawMaterial.list(),
          base44.entities.Product.list(),
          base44.entities.Calculation.list("-created_date", 20),
        ]);
        const avgCost =
          calculations.length > 0
            ? calculations.reduce((s, c) => s + (c.cost_per_liter || 0), 0) / calculations.length
            : 0;

        setStats({
          materials: materials.length,
          products: products.length,
          calculations: calculations.length,
          avgCost,
        });
        setRecent(calculations.slice(0, 5));

        // chart: cost per liter per recent calculation
        setChartData(
          calculations.slice(0, 8).map((c) => ({
            name: c.product_name || "—",
            "التكلفة/لتر": Math.round(c.cost_per_liter || 0),
          }))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = [
    { label: "المواد الخام", value: formatNumber(stats.materials), icon: Boxes, color: "text-primary", bg: "bg-primary/10" },
    { label: "المنتجات", value: formatNumber(stats.products), icon: FlaskConical, color: "text-chart-2", bg: "bg-chart-2/10" },
    { label: "الحسابات المنفذة", value: formatNumber(stats.calculations), icon: CalcIcon, color: "text-chart-3", bg: "bg-chart-3/10" },
    { label: "متوسط التكلفة/لتر", value: formatCurrency(stats.avgCost), icon: TrendingUp, color: "text-chart-4", bg: "bg-chart-4/10" },
  ];

  const quickActions = [
    { to: "/raw-materials", label: "إدارة المواد الخام", icon: Boxes, desc: "إضافة وتعديل المواد" },
    { to: "/calculator", label: "حاسبة التكلفة", icon: CalcIcon, desc: "احسب تكلفة الإنتاج" },
    { to: "/products", label: "بناء التركيبات", icon: FlaskConical, desc: "إدارة المنتجات والصيغ" },
    { to: "/packaging", label: "تكاليف التعبئة", icon: Package, desc: "تكاليف العبوات" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className="relative overflow-hidden p-4 lg:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground lg:text-sm">{kpi.label}</p>
                    <p className="mt-1.5 text-xl font-bold lg:text-2xl">{kpi.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bg} lg:h-12 lg:w-12`}>
                    <Icon className={`h-5 w-5 ${kpi.color} lg:h-6 lg:w-6`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">تكلفة اللتر لكل منتج</h3>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                <Bar dataKey="التكلفة/لتر" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="التكلفة/لتر" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              لا توجد حسابات بعد
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-bold">توزيع الحسابات حسب الحجم</h3>
          <PieBreakdown recent={recent} />
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((qa) => {
          const Icon = qa.icon;
          return (
            <Link key={qa.to} to={qa.to}>
              <Card className="group flex cursor-pointer items-center gap-3 p-4 transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{qa.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{qa.desc}</p>
                </div>
                <ArrowLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Calculations */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h3 className="font-bold">أحدث الحسابات</h3>
          </div>
          <Link to="/reports">
            <Button variant="ghost" size="sm" className="text-primary">
              عرض الكل
            </Button>
          </Link>
        </div>
        {recent.length > 0 ? (
          <div className="space-y-2">
            {recent.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.product_name}</p>
                  <p className="text-xs text-muted-foreground">{c.packaging_size}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-primary">{formatCurrency(c.cost_per_liter)}</p>
                  <p className="text-[11px] text-muted-foreground">ريال / لتر</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">لا توجد حسابات بعد</p>
            <Link to="/calculator">
              <Button>ابدأ حساباً جديداً</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}

function PieBreakdown({ recent }) {
  const [data, setData] = useState([]);
  useEffect(() => {
    const groups = {};
    recent.forEach((c) => {
      const size = c.packaging_size || "غير محدد";
      groups[size] = (groups[size] || 0) + 1;
    });
    setData(Object.entries(groups).map(([name, value]) => ({ name, value })));
  }, [recent]);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        لا توجد بيانات
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
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
      </PieChart>
    </ResponsiveContainer>
  );
}