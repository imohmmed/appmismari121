import { useState, useEffect, useCallback, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  ScrollText, Trash2, RefreshCw, Search, Filter, Circle, X,
  AlertTriangle, ShieldAlert, Activity, Terminal, Globe, ChevronLeft, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers || {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (res.status === 401) { localStorage.removeItem("adminToken"); window.location.href = "/admin/login"; throw new Error("401"); }
  if (res.status === 204) return null;
  return res.json();
}

interface LogEntry {
  id: number;
  type: "request" | "error" | "admin" | "auth" | "system";
  method?: string;
  url?: string;
  status_code?: number;
  message?: string;
  details?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  duration_ms?: number;
  created_at: string;
}

/* ── ترجمة النوع ────────────────────────────────────────────────────────── */
const typeLabels: Record<string, { label: string; color: string; bg: string; Icon: React.FC<{ className?: string }> }> = {
  request: { label: "طلب HTTP", color: "#4ade80", bg: "#4ade8012", Icon: Globe },
  error:   { label: "خطأ",      color: "#f87171", bg: "#f8717112", Icon: AlertTriangle },
  auth:    { label: "تفويض",    color: "#fb923c", bg: "#fb923c12", Icon: ShieldAlert },
  admin:   { label: "إجراء أدمن", color: A,       bg: `${A}12`,   Icon: Terminal },
  system:  { label: "النظام",   color: "#a78bfa", bg: "#a78bfa12", Icon: Activity },
};

/* ── ترجمة HTTP Method ───────────────────────────────────────────────────── */
const methodColors: Record<string, string> = {
  GET: "#4ade80", POST: "#60a5fa", PUT: "#fb923c", DELETE: "#f87171",
  PATCH: "#fbbf24", HEAD: "#a78bfa", OPTIONS: "#94a3b8",
};

/* ── ترجمة رمز الحالة ───────────────────────────────────────────────────── */
function statusLabel(code?: number): string {
  if (!code) return "";
  if (code < 300) return "ناجح";
  if (code < 400) return "إعادة توجيه";
  if (code === 400) return "طلب خاطئ";
  if (code === 401) return "غير مصرح";
  if (code === 403) return "محظور";
  if (code === 404) return "غير موجود";
  if (code === 429) return "طلبات كثيرة";
  if (code < 500) return "خطأ عميل";
  if (code === 500) return "خطأ سيرفر";
  if (code === 502) return "بوابة خاطئة";
  return "خطأ";
}

function statusColor(code?: number): string {
  if (!code) return "#6b7280";
  if (code < 300) return "#4ade80";
  if (code < 400) return "#60a5fa";
  if (code < 500) return "#fb923c";
  return "#f87171";
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `منذ ${Math.floor(diff)} ث`;
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} ي`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ar-IQ", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" });
}

/* ── بطاقة سجل ─────────────────────────────────────────────────────────── */
function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const meta = typeLabels[log.type] || typeLabels.request;
  const Icon = meta.Icon;

  return (
    <div
      className="border-b last:border-b-0 cursor-pointer hover:bg-white/[0.02] transition-colors"
      style={{ borderColor: "rgba(255,255,255,0.05)" }}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 min-h-[48px]">
        {/* نوع */}
        <div className="flex items-center gap-1.5 min-w-[90px]">
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
          <span className="text-[11px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        </div>

        {/* Method */}
        {log.method && (
          <span className="text-[10px] font-black px-1.5 py-0.5 rounded min-w-[40px] text-center" style={{ color: methodColors[log.method] || "#94a3b8", background: `${methodColors[log.method] || "#94a3b8"}15` }}>
            {log.method}
          </span>
        )}

        {/* URL */}
        <span className="flex-1 text-xs text-white/50 font-mono truncate" style={{ direction: "ltr" }}>
          {log.url || log.message || "—"}
        </span>

        {/* Status */}
        {log.status_code && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ color: statusColor(log.status_code), background: `${statusColor(log.status_code)}15` }}>
            {log.status_code} · {statusLabel(log.status_code)}
          </span>
        )}

        {/* Duration */}
        {log.duration_ms != null && (
          <span className="text-[10px] text-white/30 min-w-[40px] text-left" style={{ direction: "ltr" }}>
            {log.duration_ms}ms
          </span>
        )}

        {/* Time */}
        <span className="text-[10px] text-white/25 min-w-[70px] text-left shrink-0">{timeAgo(log.created_at)}</span>
      </div>

      {/* تفاصيل موسعة */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 space-y-1.5 text-[11px]" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
            {log.ip && <div className="flex gap-1.5"><span className="text-white/30">IP:</span><span className="text-white/60 font-mono" style={{ direction: "ltr" }}>{log.ip}</span></div>}
            {log.duration_ms != null && <div className="flex gap-1.5"><span className="text-white/30">المدة:</span><span className="text-white/60">{log.duration_ms} مللي ثانية</span></div>}
            {log.created_at && <div className="flex gap-1.5"><span className="text-white/30">الوقت:</span><span className="text-white/60">{formatTime(log.created_at)}</span></div>}
            {log.url && <div className="flex gap-1.5 col-span-2"><span className="text-white/30">الرابط:</span><span className="text-white/60 font-mono break-all" style={{ direction: "ltr" }}>{log.url}</span></div>}
            {log.message && <div className="flex gap-1.5 col-span-2"><span className="text-white/30">الرسالة:</span><span className="text-white/60">{log.message}</span></div>}
            {log.user_agent && <div className="flex gap-1.5 col-span-2"><span className="text-white/30">المتصفح:</span><span className="text-white/40 truncate text-[10px]">{log.user_agent}</span></div>}
          </div>
          {log.details && Object.keys(log.details).length > 0 && (
            <pre className="mt-2 p-2 rounded-lg text-[10px] overflow-x-auto" style={{ background: "#ffffff08", color: "#94a3b8", direction: "ltr" }}>
              {JSON.stringify(log.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const LIMIT = 50;

export default function AdminLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [clearing, setClearing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
        ...(filterType && { type: filterType }),
        ...(search && { search }),
      });
      const d = await adminFetch(`/admin/logs?${params}`);
      setLogs(d?.logs || []);
      setTotal(d?.total || 0);
    } catch {}
    setLoading(false);
  }, [page, filterType, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  const handleClear = async () => {
    if (!confirm("هل أنت متأكد من حذف جميع السجلات؟")) return;
    setClearing(true);
    try {
      await adminFetch("/admin/logs", { method: "DELETE" });
      toast({ title: "تم حذف جميع السجلات" });
      fetchLogs();
    } catch { toast({ title: "فشل الحذف", variant: "destructive" }); }
    setClearing(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${A}18` }}>
              <ScrollText className="w-4 h-4" style={{ color: A }} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">سجل الموقع</h1>
              <p className="text-xs text-white/30">{total.toLocaleString("ar-IQ")} سجل</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
              style={{
                background: autoRefresh ? `${A}20` : "transparent",
                borderColor: autoRefresh ? `${A}50` : "rgba(255,255,255,0.1)",
                color: autoRefresh ? A : "rgba(255,255,255,0.4)",
              }}
            >
              <Circle className="w-2 h-2" style={{ fill: autoRefresh ? A : "transparent", color: autoRefresh ? A : "transparent" }} />
              تحديث تلقائي
            </button>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح الكل
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "#ffffff08" }}>
            <button
              onClick={() => { setFilterType(""); setPage(0); }}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={{ background: !filterType ? "#ffffff15" : "transparent", color: !filterType ? "#fff" : "rgba(255,255,255,0.4)" }}
            >الكل</button>
            {Object.entries(typeLabels).map(([key, v]) => (
              <button
                key={key}
                onClick={() => { setFilterType(key); setPage(0); }}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                style={{
                  background: filterType === key ? `${v.color}20` : "transparent",
                  color: filterType === key ? v.color : "rgba(255,255,255,0.4)",
                }}
              >
                <v.Icon className="w-3 h-3" />
                {v.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="بحث في الروابط أو الرسائل..."
                className="w-full h-8 pr-8 pl-3 rounded-lg text-xs bg-white/5 border border-white/10 text-white/70 placeholder-white/20 focus:outline-none focus:border-white/20"
                dir="rtl"
              />
            </div>
            {search && (
              <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }} className="p-1.5 text-white/30 hover:text-white/60">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0a0a0a" }}>
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b text-[10px] font-bold text-white/20 uppercase tracking-wider" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <span className="min-w-[90px]">النوع</span>
            <span className="min-w-[40px]">الطريقة</span>
            <span className="flex-1">الرابط / الرسالة</span>
            <span className="min-w-[100px]">الحالة</span>
            <span className="min-w-[40px]">المدة</span>
            <span className="min-w-[70px]">الوقت</span>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-white/20" />
              <p className="text-sm text-white/20">جاري التحميل...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <ScrollText className="w-8 h-8 text-white/10" />
              <p className="text-sm text-white/20">لا توجد سجلات</p>
            </div>
          ) : (
            <div>
              {logs.map(log => <LogRow key={log.id} log={log} />)}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/30">
              عرض {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} من {total.toLocaleString("ar-IQ")}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/40 px-2">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
