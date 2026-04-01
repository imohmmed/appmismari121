import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Star, Trash2, EyeOff, Eye, Search, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers || {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "خطأ");
  return json;
}

interface Review {
  id: number;
  appId: number;
  appName: string | null;
  subscriptionId: number | null;
  subscriberName: string | null;
  phone: string | null;
  rating: number;
  text: string;
  isHidden: boolean;
  createdAt: string;
  subCode: string | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className="w-3.5 h-3.5" fill={s <= rating ? "#FFD700" : "none"} stroke={s <= rating ? "#FFD700" : "#555"} />
      ))}
    </div>
  );
}

function maskPhone(p: string | null) {
  if (!p) return "—";
  if (p.length <= 6) return p;
  return p.slice(0, -4).replace(/\d/g, "*") + p.slice(-4);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminReviews() {
  usePageTitle("التقييمات");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterApp, setFilterApp] = useState("all");
  const [filterHidden, setFilterHidden] = useState<"all" | "visible" | "hidden">("all");
  const [busy, setBusy] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await adminFetch("/admin/reviews");
      setReviews(data.reviews || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleHidden = async (id: number) => {
    setBusy(id);
    try {
      const data = await adminFetch(`/admin/reviews/${id}/toggle-hidden`, { method: "PATCH" });
      setReviews(prev => prev.map(r => r.id === id ? { ...r, isHidden: data.review.isHidden } : r));
      toast({ title: data.review.isHidden ? "تم الإخفاء" : "تم الإظهار" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const deleteReview = async (id: number) => {
    if (!confirm("هل تريد حذف هذا التقييم نهائياً؟")) return;
    setBusy(id);
    try {
      await adminFetch(`/admin/reviews/${id}`, { method: "DELETE" });
      setReviews(prev => prev.filter(r => r.id !== id));
      toast({ title: "تم الحذف" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const appNames = Array.from(new Set(reviews.map(r => r.appName).filter(Boolean)));

  const filtered = reviews.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || (r.appName || "").toLowerCase().includes(q)
      || (r.subscriberName || "").toLowerCase().includes(q)
      || r.text.toLowerCase().includes(q)
      || (r.subCode || "").toLowerCase().includes(q);
    const matchApp = filterApp === "all" || r.appName === filterApp;
    const matchHidden = filterHidden === "all"
      || (filterHidden === "visible" && !r.isHidden)
      || (filterHidden === "hidden" && r.isHidden);
    return matchSearch && matchApp && matchHidden;
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <AdminLayout>
      <div className="p-6 space-y-5 max-w-6xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">التقييمات</h1>
            <p className="text-xs text-white/40 mt-0.5">إدارة تقييمات التطبيقات</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#111] border border-white/5 rounded-xl px-4 py-2">
              <Star className="w-4 h-4" fill="#FFD700" stroke="#FFD700" />
              <span className="text-white font-bold">{avgRating}</span>
              <span className="text-white/40 text-xs">({reviews.length} تقييم)</span>
            </div>
            <button onClick={load} className="p-2 rounded-xl bg-[#111] border border-white/5 hover:bg-white/5 transition">
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالتطبيق أو المشترك أو النص..."
              className="w-full bg-[#111] border border-white/8 text-white text-sm rounded-xl pr-9 pl-3 py-2 outline-none focus:border-[#9fbcff]/50"
            />
          </div>
          <select
            value={filterApp}
            onChange={e => setFilterApp(e.target.value)}
            className="bg-[#111] border border-white/8 text-white/80 text-sm rounded-xl px-3 py-2 outline-none"
          >
            <option value="all">كل التطبيقات</option>
            {appNames.map(n => <option key={n!} value={n!}>{n}</option>)}
          </select>
          <div className="flex rounded-xl overflow-hidden border border-white/8">
            {(["all", "visible", "hidden"] as const).map(v => (
              <button
                key={v}
                onClick={() => setFilterHidden(v)}
                className="px-3 py-2 text-xs transition"
                style={{
                  background: filterHidden === v ? A : "#111",
                  color: filterHidden === v ? "#000" : "rgba(255,255,255,0.5)",
                  fontWeight: filterHidden === v ? 700 : 400,
                }}
              >
                {v === "all" ? "الكل" : v === "visible" ? "ظاهر" : "مخفي"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">لا توجد تقييمات</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <div
                key={r.id}
                className="bg-[#111] border border-white/5 rounded-2xl p-4 transition"
                style={{ opacity: r.isHidden ? 0.5 : 1 }}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: reviewer info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                      style={{ background: `${A}22`, color: A }}>
                      {(r.subscriberName || r.appName || "؟")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">{r.subscriberName || "مجهول"}</span>
                        {r.subCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${A}15`, color: A }}>
                            {r.subCode}
                          </span>
                        )}
                        {r.isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">مخفي</span>
                        )}
                      </div>
                      <div className="text-white/40 text-xs mt-0.5">{maskPhone(r.phone)}</div>
                    </div>
                  </div>

                  {/* Right: app + date */}
                  <div className="text-left shrink-0">
                    <div className="text-white/70 text-xs font-medium">{r.appName || "—"}</div>
                    <div className="text-white/30 text-[11px] mt-0.5">{formatDate(r.createdAt)}</div>
                  </div>
                </div>

                {/* Stars + text */}
                <div className="mt-3 flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-white/40 text-xs">{r.rating}/5</span>
                </div>
                <p className="text-white/70 text-sm mt-2 leading-relaxed">{r.text}</p>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                  <button
                    onClick={() => toggleHidden(r.id)}
                    disabled={busy === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition hover:bg-white/5 text-white/50 hover:text-white"
                  >
                    {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : r.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {r.isHidden ? "إظهار" : "إخفاء"}
                  </button>
                  <button
                    onClick={() => deleteReview(r.id)}
                    disabled={busy === r.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition hover:bg-red-500/10 text-white/50 hover:text-red-400"
                  >
                    {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
