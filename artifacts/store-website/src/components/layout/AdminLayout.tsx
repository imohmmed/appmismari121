import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Smartphone, ImageIcon, Users, UsersRound, Layers, Link2,
  FileText, Package, CreditCard, Bell, BarChart3, Settings, LogOut, ChevronLeft, Menu, X, ShieldCheck, Star, Wallet, ShoppingBag, ScrollText, Palette
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useLogoSrc } from "@/contexts/AppearanceContext";

const navGroups = [
  {
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "الرئيسية", labelEn: "Dashboard" },
      { href: "/admin/apps", icon: Smartphone, label: "التطبيقات", labelEn: "Apps" },
      { href: "/admin/featured", icon: ImageIcon, label: "البنرات", labelEn: "Banners" },
      { href: "/admin/subscribers", icon: Users, label: "المشتركين", labelEn: "Subscribers" },
      { href: "/admin/groups", icon: UsersRound, label: "المجموعات", labelEn: "Groups" },
      { href: "/admin/categories", icon: Layers, label: "الأقسام", labelEn: "Categories" },
      { href: "/admin/products", icon: ShoppingBag, label: "المنتجات", labelEn: "Products" },
    ],
  },
  {
    items: [
      { href: "/admin/subcodes", icon: Link2, label: "كودات الاشتراك", labelEn: "Sub Codes" },
      { href: "/admin/requests", icon: FileText, label: "طلبات الاشتراك", labelEn: "Requests" },
      { href: "/admin/packages", icon: Package, label: "الباقات", labelEn: "Packages" },
      { href: "/admin/purchases", icon: CreditCard, label: "المدفوعات", labelEn: "Purchases" },
      { href: "/admin/notifications", icon: Bell, label: "الإشعارات", labelEn: "Notifications" },
      { href: "/admin/downloads", icon: BarChart3, label: "التحميلات", labelEn: "Downloads" },
      { href: "/admin/reviews", icon: Star, label: "التقييمات", labelEn: "Reviews" },
      { href: "/admin/balances", icon: Wallet, label: "الأرصدة", labelEn: "Balances" },
    ],
  },
  {
    items: [
      { href: "/admin/admins", icon: ShieldCheck, label: "الأدمنية", labelEn: "Admins" },
      { href: "/admin/logs", icon: ScrollText, label: "سجل الموقع", labelEn: "Logs" },
      { href: "/admin/appearance", icon: Palette, label: "المظهر", labelEn: "Appearance" },
    ],
  },
];

const A = "var(--aa, #9fbcff)";

function SidebarContent({ location, onClose }: { location: string; onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const logoSrc = useLogoSrc();
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/admin/login");
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
        <img src={logoSrc} alt="Mismari" className="h-9 w-auto object-contain" />
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="mx-3 my-1.5 border-t border-white/5" />}
            {group.items.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all mx-2 rounded-lg",
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                  style={isActive ? { background: `${A}18`, color: A, boxShadow: `inset 2px 0 0 ${A}` } : {}}
                >
                  <item.icon className="w-4 h-4 shrink-0" style={isActive ? { color: A } : {}} />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-[9px] opacity-40 shrink-0">{item.labelEn}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 px-2 py-1">
        <Link
          href="/admin/settings"
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
            location === "/admin/settings" ? "text-white" : "text-white/40 hover:text-white hover:bg-white/5"
          )}
          style={location === "/admin/settings" ? { background: `${A}18`, color: A } : {}}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="flex-1">الإعدادات</span>
          <span className="text-[9px] opacity-40">Settings</span>
        </Link>
      </div>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: `${A}30`, color: A }}>
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">admin</p>
            <p className="text-[10px]" style={{ color: `${A}80` }}>super_admin</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const currentPage = navGroups.flatMap(g => g.items).find(i => i.href === location);
  const breadcrumb = currentPage?.label || "الرئيسية";

  return (
    <div className="min-h-screen bg-black flex" dir="rtl" style={{ color: "#ffffff", fontFamily: "inherit" }}>
      {/* Desktop sidebar */}
      <aside className="w-56 bg-[#0a0a0a] border-l border-white/5 hidden md:flex flex-col shrink-0">
        <SidebarContent location={location} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" dir="rtl">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 bg-[#0a0a0a] border-l border-white/5 flex flex-col h-full z-10">
            <SidebarContent location={location} onClose={() => setMobileSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top header */}
        <header className="h-11 bg-[#0a0a0a] border-b border-white/5 flex items-center justify-between px-4 shrink-0">
          <button
            className="md:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <span>لوحة التحكم</span>
            <ChevronLeft className="w-3 h-3" />
            <span className="text-white/70 font-medium">{breadcrumb}</span>
          </div>
          <div className="w-8 md:hidden" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-black">
          {children}
        </main>
      </div>
    </div>
  );
}
