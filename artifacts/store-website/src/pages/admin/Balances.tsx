import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Search, TrendingUp, TrendingDown, Wallet, Users, RefreshCw,
  ChevronRight, ChevronLeft, Filter, ArrowUpCircle, ArrowDownCircle, ShoppingCart
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
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "خطأ");
  return json;
}

interface Tx {
  id: number;
  type: "credit" | "debit" | "purchase";
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
  subscription_id: number;
  code: string;
  subscriber_name: string | null;
  phone: string | null;
  admin_username: string | null;
}

interface Stats {
  totalTransactions: number;
  totalCredited: number;
  totalDebited: number;
  totalPurchased: number;
  subscribersWithTx: number;
  totalBalanceInSystem: number;
  subscribersCount: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ar-IQ").format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("ar-IQ", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function typeLabel(t: string) {
  if (t === "credit") return { label: "إضافة رصيد", color: "#34C759", bg: "#34C75918", Icon: ArrowUpCircle };
  if (t === "debit") return { label: "خصم رصيد", color: "#FF3B30", bg: "#FF3B3018", Icon: ArrowDownCircle };
  return { label: "شراء", color: "#FF9F0A", bg: "#FF9F0A18", Icon: ShoppingCart };
}

function StatCard({ label, value, sub, color, Icon }: { label: string; value: string; sub?: string; color: string; Icon: React.ElementType }) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Balances() {
  usePageTitle("الأرصدة");
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      const data = await adminFetch(`/admin/balances?${params}`);
      setStats(data.stats);
      setTxs(data.transactions);
      setTotal(data.total);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">الأرصدة</h1>
            <p className="text-xs text-white/30 mt-0.5">إحصائيات وسجل عمليات الأرصدة</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="إجمالي الرصيد في النظام"
              value={`${fmt(stats.totalBalanceInSystem)} د.ع`}
              sub={`عبر ${fmt(stats.subscribersCount)} مشترك`}
              color={A}
              Icon={Wallet}
            />
            <StatCard
              label="إجمالي الإضافات"
              value={`${fmt(stats.totalCredited)} د.ع`}
              color="#34C759"
              Icon={TrendingUp}
            />
            <StatCard
              label="إجمالي الخصومات"
              value={`${fmt(stats.totalDebited)} د.ع`}
              color="#FF3B30"
              Icon={TrendingDown}
            />
            <StatCard
              label="عدد العمليات"
              value={fmt(stats.totalTransactions)}
              sub={`${fmt(stats.subscribersWithTx)} مشترك لديهم عمليات`}
              color="#FF9F0A"
              Icon={Users}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث بالاسم، الهاتف، أو الكود..."
              className="w-full bg-[#111] border border-white/8 rounded-xl py-2 pr-9 pl-3 text-sm text-white placeholder-white/20 focus:border-[#9fbcff]/30 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-white/30 shrink-0" />
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-[#111] border border-white/8 rounded-xl py-2 px-3 text-sm text-white focus:outline-none appearance-none"
            >
              <option value="">كل العمليات</option>
              <option value="credit">إضافة رصيد</option>
              <option value="debit">خصم رصيد</option>
              <option value="purchase">شراء</option>
            </select>
          </div>
        </div>

        {/* Transactions table */}
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-sm font-medium text-white">سجل العمليات</span>
            <span className="text-xs text-white/30">{fmt(total)} عملية</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-white/20" />
            </div>
          ) : txs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Wallet className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/30">لا توجد عمليات</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {txs.map(tx => {
                const { label, color, bg, Icon } = typeLabel(tx.type);
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate">{tx.subscriber_name || tx.code}</span>
                        {tx.phone && <span className="text-xs text-white/30">{tx.phone}</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{ color, borderColor: `${color}30`, background: bg }}>{label}</span>
                      </div>
                      {tx.note && <p className="text-xs text-white/40 mt-0.5 truncate">{tx.note}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/25">{fmtDate(tx.created_at)}</span>
                        {tx.admin_username && <span className="text-[10px] text-white/25">• {tx.admin_username}</span>}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-bold" style={{ color }}>
                        {tx.type === "credit" ? "+" : "-"}{fmt(tx.amount)} د.ع
                      </p>
                      <p className="text-[10px] text-white/30 text-left">رصيد: {fmt(tx.balance_after)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white disabled:opacity-20 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                السابق
              </button>
              <span className="text-xs text-white/30">صفحة {page} من {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white disabled:opacity-20 transition-colors"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
