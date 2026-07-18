import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  Boxes,
  FlaskConical,
  Calculator,
  KanbanSquare,
  FileBarChart,
  Sheet,
  Moon,
  Sun,
  Menu,
  X,
  Factory,
} from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { roleLabel, can } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, action: "read" },
  { to: "/raw-materials", label: "المواد الخام", icon: Boxes, action: "read" },
  { to: "/packaging", label: "تكاليف التعبئة", icon: Package, action: "read" },
  { to: "/products", label: "المنتجات والتركيبات", icon: FlaskConical, action: "read" },
  { to: "/calculator", label: "حاسبة التكلفة", icon: Calculator, action: "read" },
  { to: "/kanban", label: "طلبات الإنتاج", icon: KanbanSquare, action: "read" },
  { to: "/reports", label: "التقارير", icon: FileBarChart, action: "read" },
  { to: "/sheets-settings", label: "إعدادات جوجل شيتس", icon: Sheet, action: "read" },
];

export default function Layout() {
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, role } = useCurrentUser();
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Factory className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight truncate">مدينة الخطوات</p>
          <p className="text-xs text-muted-foreground leading-tight truncate">للصناعات الاحترافية</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto scrollbar-thin px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/50 px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
              {(user.full_name || user.email || "؟").charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{user.full_name || "مستخدم"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{roleLabel(role)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-l border-sidebar-border bg-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-50 h-full w-[280px] bg-sidebar lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-base font-bold lg:text-lg">
                {navItems.find((n) => n.to === location.pathname)?.label || "لوحة التحكم"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {can(role, "create") ? "وصول كامل" : "قراءة فقط"}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)}>
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}