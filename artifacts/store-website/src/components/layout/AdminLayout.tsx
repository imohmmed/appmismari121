import { Link, useLocation } from "wouter";
import { LayoutDashboard, Smartphone, Layers, CreditCard, LogOut, Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "لوحة القيادة" },
  { href: "/admin/apps", icon: Smartphone, label: "التطبيقات" },
  { href: "/admin/categories", icon: Layers, label: "الأقسام" },
  { href: "/admin/plans", icon: CreditCard, label: "الاشتراكات" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-l border-border bg-card hidden md:flex flex-col rounded-none relative z-20">
        <div className="h-20 flex items-center px-6 border-b border-border">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-bold text-white text-sm">بلس</span>
            </div>
            <span className="font-bold text-lg text-foreground">لوحة الإدارة</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200">
            <Settings className="w-5 h-5" />
            الإعدادات
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <header className="h-20 border-b border-border bg-background flex items-center justify-between px-8 relative z-10 shrink-0">
          <h1 className="text-xl font-bold text-foreground">
            {navItems.find(i => i.href === location)?.label || "لوحة القيادة"}
          </h1>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center relative hover:bg-muted transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">المدير العام</p>
                <p className="text-xs text-muted-foreground">admin@plus.com</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary border-2 border-background shadow-md" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative z-10 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
