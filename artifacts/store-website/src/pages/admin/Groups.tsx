import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Users, Loader2, RefreshCw } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, { headers: { "x-admin-token": token } });
  return res.json();
}

interface Group {
  name: string;
  count: number;
}

const COLORS = [A, "#6fa8ff", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function AdminGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/groups");
    setGroups(d?.groups || []);
    setLoading(false);
  };
  useEffect(() => { fetchGroups(); }, []);

  const total = groups.reduce((s, g) => s + g.count, 0);

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">المجموعات</h2>
            <p className="text-white/40 text-xs mt-0.5">تجميع المشتركين في مجموعات</p>
          </div>
          <button onClick={fetchGroups} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center bg-[#111111] rounded-xl border border-white/5">
            <Users className="w-10 h-10 mx-auto mb-3 text-white/20" />
            <p className="text-white/30 text-sm">لا توجد مجموعات بعد</p>
            <p className="text-white/20 text-xs mt-1">أضف مشتركين مع تحديد المجموعة من صفحة المشتركين</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {groups.map((group, i) => {
                const color = COLORS[i % COLORS.length];
                const pct = total > 0 ? Math.round((group.count / total) * 100) : 0;
                return (
                  <div key={group.name} className="bg-[#111111] rounded-xl border border-white/8 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                        <Users className="w-5 h-5" style={{ color }} />
                      </div>
                      <span className="text-xs font-mono" style={{ color: `${color}80` }}>{pct}%</span>
                    </div>
                    <p className="text-white font-semibold text-sm truncate mb-1">{group.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black" style={{ color }}>{group.count}</span>
                      <span className="text-white/40 text-xs">مشترك</span>
                    </div>
                    <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-white">تفاصيل المجموعات</h3>
              </div>
              <table className="w-full text-sm text-right">
                <thead className="bg-[#0a0a0a] border-b border-white/5">
                  <tr>
                    <th className="px-5 py-3 font-medium text-white/40 text-xs">المجموعة</th>
                    <th className="px-5 py-3 font-medium text-white/40 text-xs">عدد المشتركين</th>
                    <th className="px-5 py-3 font-medium text-white/40 text-xs">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => {
                    const color = COLORS[i % COLORS.length];
                    const pct = total > 0 ? ((g.count / total) * 100).toFixed(1) : "0";
                    return (
                      <tr key={g.name} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-white font-medium">{g.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-bold" style={{ color }}>{g.count}</td>
                        <td className="px-5 py-3 text-white/40">{pct}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#0a0a0a]">
                    <td className="px-5 py-3 font-bold text-white">المجموع</td>
                    <td className="px-5 py-3 font-bold text-white">{total}</td>
                    <td className="px-5 py-3 text-white/40">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
