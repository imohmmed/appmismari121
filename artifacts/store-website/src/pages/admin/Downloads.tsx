import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Download, TrendingUp, Smartphone, RefreshCw, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, { headers: { "x-admin-token": token } });
  if (!res.ok) return null;
  return res.json();
}

interface AppRow {
  id: number;
  name: string;
  icon: string;
  categoryName: string;
  downloads: number;
  tag: string;
}

const TAG_COLORS: Record<string, string> = {
  tweaked: "#007AFF", modded: "#AF52DE", hacked: "#FF3B30", plus: "#34C759", new: "#34C759", hot: "#FF9500",
};

export default function AdminDownloads() {
  usePageTitle("التحميلات");
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDownloads, setTotalDownloads] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/apps?limit=500&sortBy=downloads");
    const all: AppRow[] = d?.apps || [];
    const sorted = [...all].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    setApps(sorted);
    setTotalDownloads(sorted.reduce((s, a) => s + (a.downloads || 0), 0));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const topApp = apps[0];

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">التحميلات</h2>
            <p className="text-white/40 text-xs mt-0.5">إحصائيات التحميل لجميع التطبيقات</p>
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-[#111111] rounded-xl border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${A}20` }}>
                <Download className="w-4 h-4" style={{ color: A }} />
              </div>
              <span className="text-white/40 text-xs">إجمالي التحميلات</span>
            </div>
            <p className="text-2xl font-black text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
              {loading ? "..." : totalDownloads.toLocaleString("ar-IQ")}
            </p>
          </div>
          <div className="bg-[#111111] rounded-xl border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-white/40 text-xs">عدد التطبيقات</span>
            </div>
            <p className="text-2xl font-black text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
              {loading ? "..." : apps.length}
            </p>
          </div>
          <div className="bg-[#111111] rounded-xl border border-white/8 p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="text-white/40 text-xs">الأكثر تحميلاً</span>
            </div>
            {topApp ? (
              <div className="flex items-center gap-2">
                <img
                  src={topApp.icon}
                  alt={topApp.name}
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{topApp.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: A }}>
                    {(topApp.downloads || 0).toLocaleString("ar-IQ")} تحميل
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold text-white">{loading ? "..." : "—"}</p>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: A }} />
            <h3 className="text-sm font-bold text-white">ترتيب التطبيقات حسب التحميل</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : apps.length === 0 ? (
            <div className="py-16 text-center text-white/30 text-sm">لا توجد تطبيقات بعد</div>
          ) : (
            <div className="divide-y divide-white/5">
              {apps.map((app, idx) => {
                const pct = totalDownloads > 0 ? ((app.downloads || 0) / totalDownloads) * 100 : 0;
                const tc = TAG_COLORS[app.tag] || A;
                return (
                  <div key={app.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <span
                      className="text-white/25 text-xs w-6 text-center shrink-0 font-mono"
                      style={{ fontFamily: "Outfit" }}
                    >
                      {idx + 1}
                    </span>

                    {app.icon ? (
                      <img
                        src={app.icon}
                        alt={app.name}
                        className="w-9 h-9 rounded-xl object-cover shrink-0 bg-white/5"
                        onError={e => {
                          const el = e.target as HTMLImageElement;
                          el.onerror = null;
                          el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(app.name)}&background=111111&color=9fbcff&bold=true&size=64`;
                        }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc + "15" }}>
                        <Smartphone className="w-4 h-4" style={{ color: tc }} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-white text-sm font-medium truncate">{app.name}</p>
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0"
                          style={{ background: tc + "25", color: tc }}
                        >
                          {app.tag}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(pct, app.downloads > 0 ? 1 : 0)}%`, background: tc }}
                          />
                        </div>
                        <span className="text-white/25 text-[10px] shrink-0 w-9 text-left">{pct.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 min-w-[60px]">
                      <p
                        className="text-sm font-bold"
                        style={{ color: (app.downloads || 0) > 0 ? tc : "rgba(255,255,255,0.2)", fontFamily: "Outfit" }}
                      >
                        {(app.downloads || 0).toLocaleString("ar-IQ")}
                      </p>
                      <p className="text-white/25 text-[10px] mt-0.5">{app.categoryName || "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
