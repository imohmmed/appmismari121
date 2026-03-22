import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DollarSign, TrendingUp, Users, RefreshCw, Loader2, BarChart3 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, { headers: { "x-admin-token": token } });
  if (!res.ok) return null;
  return res.json();
}

interface PlanBreakdown {
  name: string;
  nameAr: string | null;
  price: number;
  currency: string;
  count: number;
  revenue: number;
}

interface RevenueData {
  totalRevenue: number;
  thisMonthRevenue: number;
  totalCount: number;
  thisMonthCount: number;
  breakdown: PlanBreakdown[];
}

export default function AdminPurchases() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/revenue");
    setData(d);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const currency = data?.breakdown[0]?.currency || "IQD";
  const maxRevenue = Math.max(...(data?.breakdown.map(p => p.revenue) || [1]));

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">الإيرادات</h2>
            <p className="text-white/40 text-xs mt-0.5">إحصائيات مالية مبنية على الاشتراكات النشطة</p>
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: DollarSign,
              label: "إجمالي الإيرادات",
              value: loading ? "..." : `${(data?.totalRevenue || 0).toLocaleString("ar-IQ")} ${currency}`,
              color: "#34C759",
              bg: "bg-green-500/15",
            },
            {
              icon: TrendingUp,
              label: "إيرادات هذا الشهر",
              value: loading ? "..." : `${(data?.thisMonthRevenue || 0).toLocaleString("ar-IQ")} ${currency}`,
              color: A,
              bg: `bg-[${A}15]`,
            },
            {
              icon: Users,
              label: "مشتركون نشطون",
              value: loading ? "..." : String(data?.totalCount || 0),
              color: "#FF9F0A",
              bg: "bg-orange-500/15",
            },
            {
              icon: BarChart3,
              label: "اشتراكات هذا الشهر",
              value: loading ? "..." : String(data?.thisMonthCount || 0),
              color: "#BF5AF2",
              bg: "bg-purple-500/15",
            },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-[#111111] rounded-xl border border-white/8 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-white/40 text-xs leading-tight">{label}</span>
              </div>
              <p className="text-xl font-black text-white" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/5">
            <BarChart3 className="w-4 h-4" style={{ color: A }} />
            <h3 className="text-sm font-bold text-white">الإيرادات حسب الباقة</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : !data || data.breakdown.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white/30 text-sm">لا توجد بيانات إيرادات حتى الآن</p>
              <p className="text-white/20 text-xs mt-1">ستظهر البيانات عند تفعيل أول اشتراك</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {data.breakdown.map((plan, idx) => {
                const pct = maxRevenue > 0 ? (plan.revenue / maxRevenue) * 100 : 0;
                const colors = [A, "#34C759", "#FF9F0A", "#BF5AF2", "#FF3B30"];
                const color = colors[idx % colors.length];
                return (
                  <div key={plan.name} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
                          style={{ background: color + "20", color }}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold">{plan.nameAr || plan.name}</p>
                          <p className="text-white/40 text-xs">
                            {plan.count} مشترك · {plan.price.toLocaleString("ar-IQ")} {plan.currency} / اشتراك
                          </p>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="text-sm font-black" style={{ color, fontFamily: "Outfit, sans-serif" }}>
                          {plan.revenue.toLocaleString("ar-IQ")}
                        </p>
                        <p className="text-white/30 text-[10px]">{plan.currency}</p>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-[#111111] rounded-xl border border-white/8 p-4">
          <p className="text-xs text-white/30 text-center">
            ملاحظة: الإيرادات المحسوبة مبنية على أسعار الباقات للاشتراكات النشطة حالياً
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
