import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Plus, Search, CheckSquare, Square, Trash2, X,
  Loader2, Copy, RefreshCw, Download
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
  return res.json();
}

interface Sub {
  id: number;
  code: string;
  subscriberName: string | null;
  planNameAr: string | null;
  planName: string | null;
  isActive: string;
  udid: string | null;
  createdAt: string;
}

interface Plan { id: number; name: string; nameAr: string | null; }

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MSM-";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function AdminSubCodes() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genPlanId, setGenPlanId] = useState("");
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [subsData, plansData] = await Promise.all([
      adminFetch("/admin/subscriptions?limit=500"),
      adminFetch("/admin/plans"),
    ]);
    setSubs(subsData?.subscriptions || []);
    setPlans(plansData?.plans || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = subs.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.code.toLowerCase().includes(q) || (s.subscriberName || "").toLowerCase().includes(q);
  });

  const allSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
  const toggleAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(s => s.id))); };
  const toggle = (id: number) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };

  const handleDelete = async (id: number) => {
    await adminFetch(`/admin/subscriptions/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchData();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`حذف ${selectedIds.size} كود؟`)) return;
    await adminFetch("/admin/subscriptions/bulk-delete", { method: "POST", body: JSON.stringify({ ids: [...selectedIds] }) });
    setSelectedIds(new Set());
    toast({ title: `تم حذف ${selectedIds.size} كود` });
    fetchData();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genPlanId) { toast({ title: "اختر الباقة", variant: "destructive" }); return; }
    setGenerating(true);
    const codes: string[] = [];
    for (let i = 0; i < genCount; i++) {
      const code = generateCode();
      await adminFetch("/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify({ code, planId: Number(genPlanId), isActive: "false" }),
      });
      codes.push(code);
    }
    toast({ title: `تم إنشاء ${genCount} كود اشتراك` });
    setModal(false);
    fetchData();
    setGenerating(false);
  };

  const exportCodes = () => {
    const lines = filtered.map(s => `${s.code}\t${s.isActive === "true" ? "مفعّل" : "غير مفعّل"}\t${s.planNameAr || s.planName || ""}`);
    const blob = new Blob([["الكود\tالحالة\tالباقة", ...lines].join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscription-codes.txt";
    a.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              placeholder="ابحث بكود الاشتراك..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-lg py-2 pr-10 pl-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
          <span className="text-xs text-white/30">{subs.length} كود</span>
          <div className="flex-1" />
          <button onClick={exportCodes} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-colors">
            <Download className="w-3.5 h-3.5" /> تصدير
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black" style={{ background: A }}>
            <Plus className="w-4 h-4" /> إنشاء أكواد
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5">
            <span className="text-sm text-white">{selectedIds.size} محدد</span>
            <div className="flex-1" />
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30">
              <Trash2 className="w-3 h-3" /> حذف المحدد
            </button>
          </div>
        )}

        <div className="bg-[#111111] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#0a0a0a] border-b border-white/5">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleAll}>{allSelected ? <CheckSquare className="w-4 h-4" style={{ color: A }} /> : <Square className="w-4 h-4 text-white/30" />}</button>
                  </th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">كود الاشتراك</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">المشترك</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">الباقة</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">الحالة</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">UDID</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">تاريخ الإنشاء</th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-white/40"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-white/30">لا توجد أكواد</td></tr>
                ) : filtered.map(sub => (
                  <tr key={sub.id} className="border-b border-white/5 hover:bg-white/2 group">
                    <td className="px-3 py-3"><button onClick={() => toggle(sub.id)}>{selectedIds.has(sub.id) ? <CheckSquare className="w-4 h-4" style={{ color: A }} /> : <Square className="w-4 h-4 text-white/30" />}</button></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold" style={{ color: A }}>{sub.code}</code>
                        <button onClick={() => { navigator.clipboard.writeText(sub.code); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-white">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-white text-sm">{sub.subscriberName || <span className="text-white/30">-</span>}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${A}20`, color: A }}>
                        {sub.planNameAr || sub.planName || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${sub.isActive === "true" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                        {sub.isActive === "true" ? "مفعّل" : "غير مفعّل"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-white/30 text-xs font-mono">{sub.udid ? sub.udid.slice(0, 14) + "…" : "-"}</td>
                    <td className="px-3 py-3 text-white/40 text-xs">{new Date(sub.createdAt).toLocaleDateString("ar-IQ")}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-base font-bold text-white">إنشاء أكواد اشتراك</h3>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleGenerate} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>الباقة</label>
                <select required value={genPlanId} onChange={e => setGenPlanId(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none">
                  <option value="">اختر باقة</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>عدد الأكواد</label>
                <input type="number" min="1" max="100" value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none" dir="ltr" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm">إلغاء</button>
                <button type="submit" disabled={generating} className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5" style={{ background: A }}>
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  إنشاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
