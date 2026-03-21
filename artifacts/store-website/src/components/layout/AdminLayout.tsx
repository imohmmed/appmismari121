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
    // Basic logout simulation
    localStorage.removeItem("adminToken");
    setLocation("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#07020D] flex">
      {/* Sidebar */}
      <aside className="w-64 border-l border-white/5 glass-panel hidden md:flex flex-col rounded-none relative z-20">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-bold text-white text-sm">بلس</span>
            </div>
            <span className="font-bold text-lg">لوحة الإدارة</span>
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
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-200">
            <Settings className="w-5 h-5" />
            الإعدادات
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-400 hover:bg-red-400/10 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/admin-bg.png`} 
            alt="Admin Background" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#07020D]/90 to-[#07020D]/40" />
        </div>

        {/* Topbar */}
        <header className="h-20 border-b border-white/5 bg-background/40 backdrop-blur-xl flex items-center justify-between px-8 relative z-10 shrink-0">
          <h1 className="text-xl font-bold">
            {navItems.find(i => i.href === location)?.label || "لوحة القيادة"}
          </h1>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full glass-button flex items-center justify-center relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-left">
                <p className="text-sm font-bold">المدير العام</p>
                <p className="text-xs text-muted-foreground">admin@plus.com</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent border-2 border-background shadow-md" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}
