import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Search, RefreshCw, Loader2, Trash2, Clock,
  CheckCircle2, XCircle, X, Smartphone, Tablet,
  Shield, Copy, ClipboardList, Mail, Phone, User,
  Package, Calendar, Filter, Monitor,
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

interface EnrollReq {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  udid: string;
  deviceType: string | null;
  planId: number | null;
  planName: string | null;
  planNameAr: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

interface Group {
  id: number;
  certName: string;
  groupType?: string;
  iphoneOfficialCount: number;
  iphoneMacCount: number;
  ipadCount: number;
}

interface Plan {
  id: number;
  name: string;
  nameAr: string | null;
}

type FilterType = "all" | "active" | "inactive";

// ─── Approve Modal ────────────────────────────────────────────────────────────
function ApproveModal({ req, onClose, onDone }: { req: EnrollReq; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | string>(req.planId || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      adminFetch("/admin/groups"),
      adminFetch("/admin/plans"),
    ]).then(([gData, pData]) => {
      setGroups(gData?.groups || []);
      setPlans(pData?.plans || []);
      setLoadingGroups(false);
    });
  }, []);

  const handleApprove = async () => {
    if (!selectedGroup.trim()) { toast({ title: "اختر مجموعة أولاً", variant: "destructive" }); return; }
    if (!selectedPlanId) { toast({ title: "اختر الباقة أولاً", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await adminFetch(`/admin/enroll-requests/${req.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ groupName: selectedGroup.trim(), planId: Number(selectedPlanId) }),
      });
      if (res?.success) {
        toast({ title: "تمت الموافقة وإضافة المشترك بنجاح" });
        onDone();
        onClose();
      } else {
        toast({ title: res?.error || "حدث خطأ", variant: "destructive" });
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
    setSaving(false);
  };

  const copyUdid = () => { navigator.clipboard.writeText(req.udid); toast({ title: "تم نسخ UDID" }); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">الموافقة على طلب الاشتراك</h3>
            <p className="text-white/40 text-xs mt-0.5">{req.name || req.udid}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Subscriber info */}
          <div className="bg-[#111111] rounded-xl p-4 space-y-2.5 text-sm">
            {[
              { icon: <User className="w-3.5 h-3.5" />, label: "الاسم", val: req.name || "—" },
              { icon: <Phone className="w-3.5 h-3.5" />, label: "الهاتف", val: req.phone || "—", mono: true },
              { icon: <Mail className="w-3.5 h-3.5" />, label: "البريد", val: req.email || "—" },
              { icon: <Smartphone className="w-3.5 h-3.5" />, label: "الجهاز", val: req.deviceType || "—" },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center gap-3">
                <span className="text-white/30 flex items-center gap-1.5">{r.icon}{r.label}</span>
                <span className={`${r.mono ? "font-mono" : ""} text-white/70`}>{r.val}</span>
              </div>
            ))}
            <div className="flex justify-between items-start gap-3 pt-1 border-t border-white/5">
              <span className="text-white/30 text-xs shrink-0">UDID</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-white/40 font-mono text-xs break-all">{req.udid}</span>
                <button onClick={copyUdid} className="p-0.5 text-white/20 hover:text-white shrink-0">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {loadingGroups ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : (
            <>
              {/* Plan selection */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: `${A}99` }}>
                  <Package className="w-3.5 h-3.5 inline ml-1" />
                  الباقة *
                </label>
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"
                >
                  <option value="">— اختر الباقة —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>
                  ))}
                </select>
                {req.planNameAr && (
                  <p className="text-white/30 text-xs mt-1">طلب المستخدم: {req.planNameAr}</p>
                )}
              </div>

              {/* Group selection */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: `${A}99` }}>
                  <Shield className="w-3.5 h-3.5 inline ml-1" />
                  المجموعة *
                </label>
                {groups.length === 0 ? (
                  <div className="py-4 text-center text-white/30 text-sm border border-white/5 rounded-xl">
                    لا توجد مجموعات — أضف مجموعة أولاً
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {groups.map(g => {
                      const iphoneCount = (g.iphoneOfficialCount || 0) + (g.iphoneMacCount || 0);
                      const ipadCount = g.ipadCount || 0;
                      const isSelected = selectedGroup === g.certName;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSelectedGroup(g.certName)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all"
                          style={isSelected
                            ? { background: `${A}15`, borderColor: `${A}40` }
                            : { background: "#111", borderColor: "rgba(255,255,255,0.08)" }
                          }
                        >
                          <Shield className="w-4 h-4 shrink-0" style={{ color: isSelected ? A : "rgba(255,255,255,0.3)" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{g.certName}</p>
                            <div className="flex gap-3 mt-0.5">
                              {iphoneCount > 0 && (
                                <span className="text-[10px] text-white/40 flex items-center gap-1">
                                  <Smartphone className="w-2.5 h-2.5" /> {iphoneCount}
                                </span>
                              )}
                              {ipadCount > 0 && (
                                <span className="text-[10px] text-white/40 flex items-center gap-1">
                                  <Tablet className="w-2.5 h-2.5" /> {ipadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: A }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-white/5 p-4 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm">إلغاء</button>
          <button
            onClick={handleApprove}
            disabled={saving || !selectedGroup.trim() || !selectedPlanId}
            className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-40 flex items-center gap-1.5"
            style={{ background: A }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            قبول وإضافة للمشتركين
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────
function RequestRow({ req, onApprove, onReject, onDelete }: {
  req: EnrollReq;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const copyUdid = () => navigator.clipboard.writeText(req.udid);

  const deviceIcon = req.deviceType === "iPad"
    ? <Tablet className="w-3.5 h-3.5" />
    : req.deviceType === "Mac"
    ? <Monitor className="w-3.5 h-3.5" />
    : <Smartphone className="w-3.5 h-3.5" />;

  const statusBadge = req.status === "approved"
    ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 whitespace-nowrap"><CheckCircle2 className="w-3 h-3" />مفعّل</span>
    : req.status === "rejected"
    ? <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 whitespace-nowrap"><XCircle className="w-3 h-3" />مرفوض</span>
    : <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-400 whitespace-nowrap"><Clock className="w-3 h-3" />معلّق</span>;

  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer group"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Name + status */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-white/30">
              {deviceIcon}
            </div>
            <div>
              <p className="text-white text-sm font-medium leading-tight">{req.name || <span className="text-white/30">—</span>}</p>
              <p className="text-white/30 text-xs">{req.phone || "—"}</p>
            </div>
          </div>
        </td>

        {/* Email */}
        <td className="px-4 py-3">
          <span className="text-white/50 text-xs">{req.email || <span className="text-white/20">—</span>}</span>
        </td>

        {/* UDID */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="text-white/30 font-mono text-xs">{req.udid.slice(0, 14)}…</span>
            <button
              onClick={e => { e.stopPropagation(); copyUdid(); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-white transition-all"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </td>

        {/* Package */}
        <td className="px-4 py-3">
          {req.planNameAr || req.planName
            ? <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: `${A}15`, color: A }}>{req.planNameAr || req.planName}</span>
            : <span className="text-white/20 text-xs">—</span>}
        </td>

        {/* Status */}
        <td className="px-4 py-3">{statusBadge}</td>

        {/* Date */}
        <td className="px-4 py-3 text-white/30 text-xs whitespace-nowrap">
          {new Date(req.createdAt).toLocaleDateString("ar-IQ")}
        </td>

        {/* Actions */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            {req.status === "pending" && (
              <>
                <button
                  onClick={onApprove}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: `${A}20`, color: A }}
                  title="قبول"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />قبول
                </button>
                <button
                  onClick={onReject}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 transition-all hover:bg-red-500/25"
                  title="رفض"
                >
                  <XCircle className="w-3.5 h-3.5" />رفض
                </button>
              </>
            )}
            {req.status === "rejected" && (
              <button
                onClick={onApprove}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{ background: `${A}15`, color: A }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />قبول
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="bg-[#0a0a0a]">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-white/30 mb-1">UDID كامل</p>
                <p className="font-mono text-white/60 break-all">{req.udid}</p>
              </div>
              <div>
                <p className="text-white/30 mb-1">نوع الجهاز</p>
                <p className="text-white/70 flex items-center gap-1">{deviceIcon}{req.deviceType || "—"}</p>
              </div>
              {req.notes && (
                <div className="col-span-2">
                  <p className="text-white/30 mb-1">ملاحظات</p>
                  <p className="text-white/60">{req.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<EnrollReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [approveTarget, setApproveTarget] = useState<EnrollReq | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const data = await adminFetch("/admin/enroll-requests");
    setRequests(data?.requests || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = requests.filter(r => {
    const matchesFilter =
      filter === "active" ? r.status === "approved"
      : filter === "inactive" ? r.status === "rejected"
      : true;

    if (!matchesFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(s) ||
      (r.phone || "").includes(s) ||
      (r.email || "").toLowerCase().includes(s) ||
      r.udid.toLowerCase().includes(s) ||
      (r.planNameAr || r.planName || "").toLowerCase().includes(s)
    );
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const approvedCount = requests.filter(r => r.status === "approved").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;

  const handleReject = async (id: number) => {
    await adminFetch(`/admin/enroll-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "rejected" }),
    });
    toast({ title: "تم رفض الطلب" });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("حذف هذا الطلب نهائياً؟")) return;
    await adminFetch(`/admin/enroll-requests/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchData();
  };

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-white font-bold text-lg">طلبات الاشتراك</h1>
            <p className="text-white/30 text-xs mt-0.5">إدارة جميع طلبات التسجيل والاشتراك</p>
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "معلّق", count: pendingCount, color: "#f59e0b", bg: "#f59e0b15" },
            { label: "مقبول", count: approvedCount, color: "#22c55e", bg: "#22c55e15" },
            { label: "مرفوض", count: rejectedCount, color: "#ef4444", bg: "#ef444415" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 border border-white/5 flex items-center gap-3" style={{ background: s.bg }}>
              <span className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</span>
              <span className="text-white/50 text-sm">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              placeholder="ابحث بالاسم، الهاتف، البريد، UDID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-lg py-2 pr-10 pl-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#111111] border border-white/10 rounded-lg p-1">
            {([
              { key: "all", label: `الكل (${requests.length})` },
              { key: "active", label: `مفعّل (${approvedCount})` },
              { key: "inactive", label: `غير مفعّل (${rejectedCount})` },
            ] as { key: FilterType; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={filter === f.key ? { background: A, color: "#000" } : { color: "rgba(255,255,255,0.4)" }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111111] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#0a0a0a] border-b border-white/5">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-white/40">المشترك</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40">البريد</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40">UDID</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40">الباقة</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40">الحالة</th>
                  <th className="px-4 py-3 text-xs font-medium text-white/40">تاريخ الطلب</th>
                  <th className="px-4 py-3 w-36" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-white/30">
                      <Loader2 className="w-5 h-5 animate-spin inline mb-2" />
                      <p className="text-sm">جارٍ التحميل...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <ClipboardList className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">لا توجد طلبات</p>
                      {filter !== "all" && (
                        <button onClick={() => setFilter("all")} className="mt-2 text-xs underline" style={{ color: A }}>
                          عرض الكل
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filtered.map(req => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    onApprove={() => setApproveTarget(req)}
                    onReject={() => handleReject(req.id)}
                    onDelete={() => handleDelete(req.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
              <p className="text-white/30 text-xs">يُعرض {filtered.length} من {requests.length} طلب</p>
            </div>
          )}
        </div>
      </div>

      {approveTarget && (
        <ApproveModal
          req={approveTarget}
          onClose={() => setApproveTarget(null)}
          onDone={fetchData}
        />
      )}
    </AdminLayout>
  );
}
