import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Smartphone, Users, Layers, Star, Shield, Package,
  Link2, TrendingUp, Activity, ArrowUpRight, Feather,
  CheckCircle, AlertCircle, Clock, BarChart3,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    headers: { "x-admin-token": token },
  });
  if (!res.ok) return null;
  return res.json();
}

interface Stats {
  totalApps: number;
  totalCategories: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
}

interface GroupSummary {
  totalGroups: number;
  totalIPhone: number;
  totalIPad: number;
  totalPending: number;
  fullCerts: number;
}

interface TopApp {
  id: number;
  name: string;
  icon: string;
  downloads: number;
  categoryName: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [groups, setGroups] = useState<GroupSummary | null>(null);
  const [topApps, setTopApps] = useState<TopApp[]>([]);
  const [plans, setPlans] = useState(0);
  const [banners, setBanners] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      const [statsData, groupsData, appsData, plansData, bannersData] = await Promise.all([
        adminFetch("/admin/stats"),
        adminFetch("/admin/groups"),
        adminFetch("/admin/apps?limit=5&section=most_downloaded"),
        adminFetch("/admin/plans"),
        adminFetch("/admin/featured"),
      ]);

      if (statsData) setStats(statsData);

      if (groupsData?.groups) {
        const gs = groupsData.groups as any[];
        const IPHONE_TOTAL = 196;
        const IPAD_LIMIT = 98;
        setGroups({
          totalGroups: gs.length,
          totalIPhone: gs.reduce((s: number, g: any) => s + (g.iphoneOfficialCount || 0) + (g.iphoneMacCount || 0), 0),
          totalIPad: gs.reduce((s: number, g: any) => s + (g.ipadCount || 0), 0),
          totalPending: gs.reduce((s: number, g: any) => s + (g.pendingCount || 0), 0),
          fullCerts: gs.filter((g: any) =>
            (g.iphoneOfficialCount + g.iphoneMacCount) >= IPHONE_TOTAL || g.ipadCount >= IPAD_LIMIT
          ).length,
        });
      }

      if (appsData?.apps) setTopApps(appsData.apps.slice(0, 5));
      if (plansData?.plans) setPlans(plansData.plans.length);
      if (bannersData?.banners) setBanners(bannersData.banners.length);
      setLoading(false);
    };
    loadAll();
  }, []);

  const statCards = [
    {
      label: "التطبيقات",
      value: stats?.totalApps ?? 0,
      sub: "في المتجر",
      icon: Smartphone,
      color: "#3b82f6",
      href: "/admin/apps",
    },
    {
      label: "المشتركين النشطين",
      value: stats?.activeSubscriptions ?? 0,
      sub: `من ${stats?.totalSubscriptions ?? 0} كلي`,
      icon: Users,
      color: "#8b5cf6",
      href: "/admin/subscribers",
    },
    {
      label: "شهادات المجموعات",
      value: groups?.totalGroups ?? 0,
      sub: groups?.fullCerts ? `${groups.fullCerts} ممتلئة` : "جميعها متاحة",
      icon: Shield,
      color: groups?.fullCerts ? "#ef4444" : "#22c55e",
      href: "/admin/groups",
    },
    {
      label: "التصنيفات",
      value: stats?.totalCategories ?? 0,
      sub: "قسم تطبيقات",
      icon: Layers,
      color: A,
      href: "/admin/categories",
    },
  ];

  const statCards2 = [
    {
      label: "آيفون مُسجَّل",
      value: groups?.totalIPhone ?? 0,
      sub: `${groups?.totalGroups ? (groups.totalGroups * 196) : 0} مقعد كلي`,
      icon: Smartphone,
      color: "#22c55e",
    },
    {
      label: "آيباد مُسجَّل",
      value: groups?.totalIPad ?? 0,
      sub: `${groups?.totalGroups ? (groups.totalGroups * 98) : 0} مقعد كلي`,
      icon: Feather,
      color: A,
    },
    {
      label: "انتظار تفعيل",
      value: groups?.totalPending ?? 0,
      sub: "في كل الشهادات",
      icon: Clock,
      color: (groups?.totalPending ?? 0) > 0 ? "#f59e0b" : "#475569",
    },
    {
      label: "الباقات",
      value: plans,
      sub: "خطط الاشتراك",
      icon: Package,
      color: "#ec4899",
    },
    {
      label: "كودات الاشتراك",
      value: stats?.totalSubscriptions ?? 0,
      sub: "كل الكودات",
      icon: Link2,
      color: "#06b6d4",
    },
    {
      label: "البانرات المميزة",
      value: banners,
      sub: "في الصفحة الرئيسية",
      icon: Star,
      color: "#f59e0b",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">

        {/* Main stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <Link key={s.label} href={s.href}>
              <div className="bg-[#111111] rounded-xl p-4 border border-white/8 hover:border-white/15 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white/40 text-xs mb-1">{s.label}</p>
                    <p className="text-2xl font-black text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
                      {loading ? <span className="text-white/20">...</span> : s.value.toLocaleString("ar-IQ")}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: s.color + "20" }}>
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-white/30 text-xs flex-1">{s.sub}</p>
                  <ArrowUpRight className="w-3 h-3 text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Sub stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {statCards2.map((s) => (
            <div key={s.label} className="bg-[#111111] rounded-xl p-4 border border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + "20" }}>
                  <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                </div>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
              <p className="text-xl font-black leading-tight" style={{ fontFamily: "Outfit, sans-serif", color: s.color }}>
                {loading ? "..." : s.value.toLocaleString("ar-IQ")}
              </p>
              <p className="text-white/20 text-xs mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Top apps */}
          <div className="lg:col-span-2 bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: A }} />
                <h3 className="text-sm font-bold text-white">الأكثر تحميلاً</h3>
              </div>
              <Link href="/admin/downloads">
                <span className="text-xs" style={{ color: A }}>عرض الكل</span>
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-8 text-center text-white/30 text-sm">جاري التحميل...</div>
              ) : topApps.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-sm">لا توجد تطبيقات بعد</div>
              ) : topApps.map((app, idx) => (
                <div key={app.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-white/20 text-xs w-5 text-left shrink-0" style={{ fontFamily: "Outfit" }}>
                    {idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: A + "15" }}>
                    <Smartphone className="w-3.5 h-3.5" style={{ color: A }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{app.name}</p>
                    <p className="text-white/30 text-xs truncate">{app.categoryName}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: A }}>
                    <TrendingUp className="w-3 h-3" />
                    <span style={{ fontFamily: "Outfit" }}>{app.downloads.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
              <Activity className="w-4 h-4" style={{ color: A }} />
              <h3 className="text-sm font-bold text-white">حالة النظام</h3>
            </div>
            <div className="p-4 space-y-2">
              {[
                { label: "خادم API", status: "يعمل", ok: true },
                { label: "قاعدة البيانات", status: "متصل", ok: true },
                { label: "شهادات الأجهزة", status: groups?.fullCerts ? `${groups.fullCerts} ممتلئة` : "طبيعية", ok: !groups?.fullCerts },
                { label: "الكودات المعلقة", status: groups?.totalPending ? `${groups.totalPending} معلق` : "لا يوجد", ok: !groups?.totalPending },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-white/60 text-xs">{item.label}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${item.ok ? "text-green-400" : "text-yellow-400"}`}>
                    {item.ok
                      ? <CheckCircle className="w-3 h-3" />
                      : <AlertCircle className="w-3 h-3" />
                    }
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-4 pb-4 space-y-2">
              {[
                { href: "/admin/apps", label: "إدارة التطبيقات" },
                { href: "/admin/subscribers", label: "إدارة المشتركين" },
                { href: "/admin/groups", label: "شهادات المجموعات" },
                { href: "/admin/settings", label: "الإعدادات" },
              ].map(link => (
                <Link key={link.href} href={link.href}>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5 cursor-pointer"
                    style={{ color: A }}>
                    <span>{link.label}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-50" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
