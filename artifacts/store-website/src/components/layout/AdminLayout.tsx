import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Smartphone, Star, Users, UsersRound, Layers, Link2,
  FileText, Package, CreditCard, Bell, BarChart3, Settings, LogOut, ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "الرئيسية", labelEn: "Dashboard" },
      { href: "/admin/apps", icon: Smartphone, label: "التطبيقات", labelEn: "Apps" },
      { href: "/admin/featured", icon: Star, label: "المميزات", labelEn: "Featured" },
      { href: "/admin/subscribers", icon: Users, label: "المشتركين", labelEn: "Subscribers" },
      { href: "/admin/groups", icon: UsersRound, label: "المجموعات", labelEn: "Groups" },
      { href: "/admin/categories", icon: Layers, label: "التصنيفات", labelEn: "Categories" },
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
    ],
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/admin/login");
  };

  const currentPage = navGroups.flatMap(g => g.items).find(i => i.href === location);
  const breadcrumb = currentPage?.label || "الرئيسية";

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex" dir="rtl">
      <aside className="w-60 bg-[#16162a] border-l border-[#2a2a45] hidden md:flex flex-col shrink-0">
        <div className="h-16 flex items-center justify-end gap-3 px-5 border-b border-[#2a2a45]">
          <span className="font-bold text-white text-base">مسماري</span>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="font-black text-white text-xs">+</span>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="mx-4 my-2 border-t border-[#2a2a45]" />}
              {group.items.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all mx-2 rounded-lg",
                      isActive
                        ? "bg-[#2a2a50] text-white"
                        : "text-[#8888aa] hover:text-white hover:bg-[#1e1e38]"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] opacity-60">{item.labelEn}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-[#2a2a45] p-3 space-y-1">
          <Link
            href="/admin/settings"
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              location === "/admin/settings"
                ? "bg-[#2a2a50] text-white"
                : "text-[#8888aa] hover:text-white hover:bg-[#1e1e38]"
            )}
          >
            <Settings className="w-4 h-4" />
            <span className="flex-1">الإعدادات</span>
            <span className="text-[10px] opacity-60">Settings</span>
          </Link>
        </div>

        <div className="border-t border-[#2a2a45] p-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">admin</p>
              <p className="text-[10px] text-[#8888aa]">super_admin</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg text-[#8888aa] hover:text-red-400 hover:bg-[#1e1e38] transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-12 bg-[#1a1a2e] border-b border-[#2a2a45] flex items-center justify-between px-6 shrink-0">
          <div />
          <div className="flex items-center gap-2 text-sm text-[#8888aa]">
            <span>لوحة التحكم</span>
            <ChevronLeft className="w-3 h-3" />
            <span className="text-white">{breadcrumb}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[#1a1a2e]">
          {children}
        </main>
      </div>
    </div>
  );
}
