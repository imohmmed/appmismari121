import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Plus, Search, CheckSquare, Square, Trash2, X,
  Loader2, Copy, RefreshCw, Download, Smartphone, Tablet, Shield,
  FlaskConical, AlertCircle, Check
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
  phone: string | null;
  email: string | null;
  planNameAr: string | null;
  planName: string | null;
  deviceType: string | null;
  groupName: string | null;
  isActive: string;
  udid: string | null;
  createdAt: string;
}

interface Plan { id: number; name: string; nameAr: string | null; }
interface Group {
  id: number;
  certName: string;
  groupType: string;
  iphoneOfficialCount: number;
  iphoneMacCount: number;
  ipadCount: number;
}

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
  usePageTitle("كودات الاشتراك");
  const { toast } = useToast();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [genPlanId, setGenPlanId] = useState("");
  const [genDeviceType, setGenDeviceType] = useState<"iPhone" | "iPad">("iPhone");
  const [genGroupName, setGenGroupName] = useState("");
  const [generating, setGenerating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [subsData, plansData, groupsData] = await Promise.all([
      adminFetch("/admin/subscriptions?limit=500"),
      adminFetch("/admin/plans"),
      adminFetch("/admin/groups"),
    ]);
    setSubs(subsData?.subscriptions || []);
    setPlans(plansData?.plans || []);
    setGroups(groupsData?.groups || []);
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
    if (!genGroupName.trim()) { toast({ title: "⚠️ يجب اختيار مجموعة", description: "لا يمكن إنشاء كود بدون مجموعة", variant: "destructive" }); return; }
    setGenerating(true);
    const codes: string[] = [];
    for (let i = 0; i < genCount; i++) {
      const code = generateCode();
      await adminFetch("/admin/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          code,
          planId: Number(genPlanId),
          isActive: "false",
          deviceType: genDeviceType,
          groupName: genGroupName.trim(),
        }),
      });
      codes.push(code);
    }
    toast({ title: `✅ تم إنشاء ${genCount} كود اشتراك`, description: `المجموعة: ${genGroupName}` });
    setModal(false);
    setGenGroupName("");
    fetchData();
    setGenerating(false);
  };

  const exportCodes = () => {
    const lines = filtered.map(s => `${s.code}\t${s.isActive === "true" ? "مفعّل" : "غير مفعّل"}\t${s.planNameAr || s.planName || ""}\t${s.deviceType || ""}\t${s.groupName || ""}`);
    const blob = new Blob([["الكود\tالحالة\tالباقة\tالجهاز\tالمجموعة", ...lines].join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscription-codes.txt";
    a.click();
  };

  const inp = "w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20";

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
                  <th className="px-3 py-3 text-xs font-medium text-white/40">رقم الهاتف</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">البريد</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">UDID</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">الجهاز</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">المجموعة</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">الباقة</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">الحالة</th>
                  <th className="px-3 py-3 text-xs font-medium text-white/40">تاريخ الإنشاء</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="p-8 text-center text-white/40"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className="p-8 text-center text-white/30">لا توجد أكواد</td></tr>
                ) : filtered.map(sub => (
                  <tr key={sub.id} className="border-b border-white/5 hover:bg-white/2 group">
                    <td className="px-3 py-3"><button onClick={() => toggle(sub.id)}>{selectedIds.has(sub.id) ? <CheckSquare className="w-4 h-4" style={{ color: A }} /> : <Square className="w-4 h-4 text-white/30" />}</button></td>
                    {/* Code */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold" style={{ color: A }}>{sub.code}</code>
                        <button onClick={() => { navigator.clipboard.writeText(sub.code); toast({ title: "تم النسخ" }); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-white">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    {/* Name */}
                    <td className="px-3 py-3 text-white text-sm whitespace-nowrap">{sub.subscriberName || <span className="text-white/30">—</span>}</td>
                    {/* Phone */}
                    <td className="px-3 py-3 text-white/60 text-xs font-mono whitespace-nowrap">{sub.phone || <span className="text-white/20">—</span>}</td>
                    {/* Email */}
                    <td className="px-3 py-3 text-white/50 text-xs max-w-[140px]">
                      <span className="truncate block">{sub.email || <span className="text-white/20">—</span>}</span>
                    </td>
                    {/* UDID */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-white/30 text-xs font-mono">{sub.udid ? sub.udid.slice(0, 14) + "…" : "—"}</span>
                        {sub.udid && (
                          <button onClick={() => { navigator.clipboard.writeText(sub.udid!); toast({ title: "تم نسخ UDID" }); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-white">
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    {/* Device */}
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1 text-white/60 text-xs whitespace-nowrap">
                        {sub.deviceType === "iPad" ? <Tablet className="w-3 h-3" /> : sub.deviceType ? <Smartphone className="w-3 h-3" /> : null}
                        {sub.deviceType || "—"}
                      </span>
                    </td>
                    {/* Group */}
                    <td className="px-3 py-3 text-white/40 text-xs whitespace-nowrap">{sub.groupName || "—"}</td>
                    {/* Plan */}
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${A}20`, color: A }}>
                        {sub.planNameAr || sub.planName || "—"}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${sub.isActive === "true" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                        {sub.isActive === "true" ? "مفعّل" : "غير مفعّل"}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="px-3 py-3 text-white/40 text-xs whitespace-nowrap">{new Date(sub.createdAt).toLocaleDateString("ar-IQ")}</td>
                    {/* Delete */}
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
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="text-base font-bold text-white">إنشاء أكواد اشتراك</h3>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleGenerate} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>الباقة *</label>
                <select required value={genPlanId} onChange={e => setGenPlanId(e.target.value)} className={inp}>
                  <option value="">اختر باقة</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>نوع الجهاز *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["iPhone", "iPad"] as const).map(dt => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setGenDeviceType(dt)}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all"
                      style={genDeviceType === dt
                        ? { background: `${A}15`, borderColor: `${A}40`, color: A }
                        : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                      }
                    >
                      {dt === "iPad" ? <Tablet className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                      {dt}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Group Picker (required) ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold flex items-center gap-1" style={{ color: A }}>
                    <Shield className="w-3 h-3" />
                    المجموعة <span className="text-red-400">*</span>
                  </label>
                  {genGroupName && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: `${A}20`, color: A }}>
                      <Check className="w-3 h-3" />{genGroupName}
                    </span>
                  )}
                </div>

                {groups.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-red-400 text-xs">لا توجد مجموعات متاحة — أضف مجموعة أولاً</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-xl border border-white/10 p-2"
                    style={{ background: "rgba(0,0,0,0.3)" }}>
                    {groups.map(g => {
                      const iphoneCount = (g.iphoneOfficialCount || 0) + (g.iphoneMacCount || 0);
                      const ipadCount = g.ipadCount || 0;
                      const isTest = g.groupType === "test_certificate";
                      const isSelected = genGroupName === g.certName;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGenGroupName(g.certName)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-right transition-all"
                          style={isSelected
                            ? { background: `${A}18`, borderColor: `${A}45`, color: A }
                            : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)" }
                          }
                        >
                          {isSelected
                            ? <Check className="w-3.5 h-3.5 shrink-0" style={{ color: A }} />
                            : isTest
                              ? <FlaskConical className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
                              : <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                          }
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-medium truncate">{g.certName}</p>
                            {isTest && (
                              <p className="text-xs text-yellow-400/70 mt-0.5">شهادة تجريبية</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                            <span className="flex items-center gap-0.5">
                              <Smartphone className="w-2.5 h-2.5" />{iphoneCount}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Tablet className="w-2.5 h-2.5" />{ipadCount}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!genGroupName && groups.length > 0 && (
                  <p className="text-xs text-white/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    مطلوب — اختر مجموعة لإنشاء الكود
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>عدد الأكواد</label>
                <input type="number" min="1" max="100" value={genCount} onChange={e => setGenCount(Number(e.target.value))}
                  className={inp} dir="ltr" />
              </div>
            </form>
            <div className="border-t border-white/5 p-4 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm">إلغاء</button>
              <button
                onClick={handleGenerate as any}
                disabled={generating || !genGroupName || !genPlanId || groups.length === 0}
                className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-opacity"
                style={{ background: A }}
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {!genGroupName ? "اختر مجموعة أولاً" : !genPlanId ? "اختر الباقة أولاً" : "إنشاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
