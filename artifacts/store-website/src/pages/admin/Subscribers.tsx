import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Search, Plus, X, Trash2, Edit2, CheckSquare, Square,
  Loader2, AlertCircle, Copy, RefreshCw, Bell, Link2,
  PauseCircle, PlayCircle, Wallet, ArrowUpCircle, ArrowDownCircle
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

interface Sub {
  id: number;
  code: string;
  subscriberName: string | null;
  phone: string | null;
  email: string | null;
  udid: string | null;
  deviceType: string | null;
  groupName: string | null;
  planId: number;
  planName: string | null;
  planNameAr: string | null;
  sourceType: string | null;
  isActive: string;
  balance: number;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface BalanceTx {
  id: number;
  type: "credit" | "debit" | "purchase";
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

function BalanceModal({ sub, onClose, onChanged }: { sub: Sub; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(true);
  const [balance, setBalance] = useState(sub.balance);
  const [txs, setTxs] = useState<BalanceTx[]>([]);

  const loadTxs = async () => {
    setTxLoading(true);
    try {
      const data = await adminFetch(`/admin/subscriptions/${sub.id}/balance`);
      setBalance(data.balance);
      setTxs(data.transactions || []);
    } catch {}
    setTxLoading(false);
  };

  useEffect(() => { loadTxs(); }, []);

  const handleSubmit = async () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) { toast({ title: "أدخل مبلغاً صحيحاً", variant: "destructive" }); return; }
    setLoading(true);
    try {
      await adminFetch(`/admin/subscriptions/${sub.id}/balance`, {
        method: "POST",
        body: JSON.stringify({ type, amount: amt, note: note.trim() || undefined }),
      });
      toast({ title: type === "credit" ? `تمت إضافة ${amt.toLocaleString("ar-IQ")} د.ع` : `تم خصم ${amt.toLocaleString("ar-IQ")} د.ع` });
      setAmount("");
      setNote("");
      loadTxs();
      onChanged();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">إدارة الرصيد</h3>
            <p className="text-white/40 text-xs mt-0.5">{sub.subscriberName || sub.code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Current balance */}
          <div className="bg-[#111] border border-white/5 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-white/50">الرصيد الحالي</span>
            <span className="text-xl font-bold" style={{ color: "#9fbcff" }}>
              {(balance ?? 0).toLocaleString("ar-IQ")} <span className="text-sm font-normal text-white/40">د.ع</span>
            </span>
          </div>

          {/* Type selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setType("credit")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all ${type === "credit" ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/10 text-white/30 hover:text-white"}`}
            >
              <ArrowUpCircle className="w-4 h-4" /> إضافة رصيد
            </button>
            <button
              onClick={() => setType("debit")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all ${type === "debit" ? "border-red-500/40 bg-red-500/15 text-red-400" : "border-white/10 text-white/30 hover:text-white"}`}
            >
              <ArrowDownCircle className="w-4 h-4" /> خصم رصيد
            </button>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">المبلغ (د.ع)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              dir="ltr"
              className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">ملاحظة (اختياري)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="سبب العملية..."
              className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${type === "credit" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : type === "credit" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
            {type === "credit" ? "إضافة الرصيد" : "خصم الرصيد"}
          </button>

          {/* Transaction history */}
          <div>
            <p className="text-xs text-white/30 mb-2">آخر العمليات</p>
            {txLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-white/20" /></div>
            ) : txs.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-4">لا توجد عمليات سابقة</p>
            ) : (
              <div className="space-y-1">
                {txs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-green-500/15" : "bg-red-500/15"}`}>
                      {tx.type === "credit"
                        ? <ArrowUpCircle className="w-3 h-3 text-green-400" />
                        : <ArrowDownCircle className="w-3 h-3 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 truncate">{tx.note || (tx.type === "credit" ? "إضافة رصيد" : "خصم رصيد")}</p>
                      <p className="text-[10px] text-white/25">{new Date(tx.createdAt).toLocaleDateString("ar-IQ")}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${tx.type === "credit" ? "text-green-400" : "text-red-400"}`}>
                      {tx.type === "credit" ? "+" : "-"}{(tx.amount ?? 0).toLocaleString("ar-IQ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Plan { id: number; name: string; nameAr: string | null; }

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: `${A}99` }}>{label}</label>
      {children}
    </div>
  );
}
function Input({ ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20 ${p.className || ""}`} />;
}
function Select({ ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none appearance-none" />;
}

const blankForm = { code: "", subscriberName: "", phone: "", email: "", udid: "", deviceType: "iPhone", groupName: "", planId: "", isActive: "true" };

function NotifyModal({ sub, onClose }: { sub: Sub; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { toast({ title: "يرجى إدخال العنوان والرسالة", variant: "destructive" }); return; }
    setSending(true);
    try {
      const token = localStorage.getItem("adminToken") || "";
      await fetch(`${API}/api/admin/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ title, body, target: `sub:${sub.id}:${sub.code}` }),
      });
      toast({ title: `تم إرسال الرسالة إلى ${sub.subscriberName || sub.code}` });
      onClose();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h3 className="text-sm font-bold text-white">إرسال رسالة</h3>
            <p className="text-white/40 text-xs mt-0.5">{sub.subscriberName || sub.code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: `${A}99` }}>العنوان</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="عنوان الرسالة"
              className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: `${A}99` }}>الرسالة</label>
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              rows={3}
              placeholder="اكتب رسالتك هنا..."
              className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 text-sm">إلغاء</button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: A }}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubModal({ sub, plans, onClose, onSaved }: { sub?: Sub; plans: Plan[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(sub ? {
    code: sub.code,
    subscriberName: sub.subscriberName || "",
    phone: sub.phone || "",
    email: sub.email || "",
    udid: sub.udid || "",
    deviceType: sub.deviceType || "iPhone",
    groupName: sub.groupName || "",
    planId: String(sub.planId),
    isActive: sub.isActive,
  } : { ...blankForm });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (sub) {
        const { udid: _udid, ...editFields } = form;
        await adminFetch(`/admin/subscriptions/${sub.id}`, { method: "PUT", body: JSON.stringify({ ...editFields, planId: Number(form.planId) }) });
        toast({ title: "تم تحديث الاشتراك" });
      } else {
        await adminFetch("/admin/subscriptions", { method: "POST", body: JSON.stringify({ ...form, planId: Number(form.planId) }) });
        toast({ title: "تمت إضافة الاشتراك" });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <h3 className="text-base font-bold text-white">{sub ? "تعديل اشتراك" : "إضافة اشتراك"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FieldGroup label="كود الاشتراك *">
                <Input required dir="ltr" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="SUB-XXXXX" />
              </FieldGroup>
            </div>
            <FieldGroup label="الاسم">
              <Input value={form.subscriberName} onChange={e => setForm({ ...form, subscriberName: e.target.value })} placeholder="اسم المشترك" />
            </FieldGroup>
            <FieldGroup label="رقم الهاتف">
              <Input dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+964..." />
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="البريد الإلكتروني">
                <Input type="email" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </FieldGroup>
            </div>
            <FieldGroup label="UDID">
              {sub ? (
                <>
                  <div className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-3 text-sm text-white/40 font-mono break-all cursor-not-allowed select-all" dir="ltr">
                    {form.udid || <span className="text-white/20">—</span>}
                  </div>
                  <p className="text-[11px] text-white/25 mt-1">لا يمكن تعديل UDID بعد الإضافة — تم رفعه إلى شهادة Apple</p>
                </>
              ) : (
                <Input dir="ltr" value={form.udid} onChange={e => setForm({ ...form, udid: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
              )}
            </FieldGroup>
            <FieldGroup label="نوع الجهاز">
              <Select value={form.deviceType} onChange={e => setForm({ ...form, deviceType: e.target.value })}>
                <option value="iPhone">iPhone</option>
                <option value="iPad">iPad</option>
              </Select>
            </FieldGroup>
            <FieldGroup label="المجموعة">
              <Input value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })} placeholder="مجموعة..." />
            </FieldGroup>
            <FieldGroup label="الباقة *">
              <Select required value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}>
                <option value="">اختر باقة</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>)}
              </Select>
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="الحالة">
                <Select value={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.value })}>
                  <option value="true">نشط</option>
                  <option value="false">غير نشط</option>
                </Select>
              </FieldGroup>
            </div>
          </div>
        </form>
        <div className="border-t border-white/5 p-4 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm">إلغاء</button>
          <button onClick={handleSubmit as any} disabled={loading} className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5" style={{ background: A }}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {sub ? "حفظ التعديلات" : "إضافة"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSubscribers() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editSub, setEditSub] = useState<Sub | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notifySub, setNotifySub] = useState<Sub | null>(null);
  const [balanceSub, setBalanceSub] = useState<Sub | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsData, plansData] = await Promise.all([
        adminFetch(`/admin/subscriptions?limit=200${search ? `&search=${encodeURIComponent(search)}` : ""}`),
        adminFetch("/admin/plans"),
      ]);
      setSubs(subsData?.subscriptions || []);
      setPlans(plansData?.plans || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [search]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subs;
    const q = search.toLowerCase();
    return subs.filter(s =>
      (s.subscriberName || "").toLowerCase().includes(q) ||
      (s.phone || "").includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.udid || "").toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  }, [subs, search]);

  const allSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
  const toggleAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(s => s.id))); };
  const toggle = (id: number) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الاشتراك؟")) return;
    await adminFetch(`/admin/subscriptions/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchData();
  };

  const handleToggleActive = async (sub: Sub) => {
    const newActive = sub.isActive === "true" ? "false" : "true";
    try {
      await adminFetch(`/admin/subscriptions/${sub.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: newActive }),
      });
      toast({
        title: newActive === "false"
          ? `تم إيقاف اشتراك ${sub.subscriberName || sub.code}`
          : `تم تفعيل اشتراك ${sub.subscriberName || sub.code}`,
      });
      fetchData();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} اشتراك؟`)) return;
    setDeleting(true);
    await adminFetch("/admin/subscriptions/bulk-delete", { method: "POST", body: JSON.stringify({ ids: [...selectedIds] }) });
    setSelectedIds(new Set());
    toast({ title: `تم حذف ${selectedIds.size} اشتراك` });
    fetchData();
    setDeleting(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              placeholder="ابحث بالاسم، الرقم، UDID، الكود..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-lg py-2 pr-10 pl-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>
          <span className="text-xs text-white/30">{subs.length} مشترك</span>
          <div className="flex-1" />
          <button onClick={fetchData} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setModal("add"); setEditSub(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-black"
            style={{ background: A }}
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5">
            <span className="text-sm text-white">{selectedIds.size} محدد</span>
            <div className="flex-1" />
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              حذف المحدد
            </button>
          </div>
        )}

        <div className="bg-[#111111] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#0a0a0a] border-b border-white/5">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleAll} className="text-white/40 hover:text-white">
                      {allSelected ? <CheckSquare className="w-4 h-4" style={{ color: A }} /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">المشترك</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">رقم الهاتف</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">البريد</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">UDID</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">الجهاز</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">الباقة</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">نوع التسجيل</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">المجموعة</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">الحالة</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">الرصيد</th>
                  <th className="px-3 py-3 font-medium text-white/40 text-xs whitespace-nowrap">تاريخ التسجيل</th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={13} className="p-8 text-center text-white/40"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={13} className="p-8 text-center text-white/40">لا يوجد مشتركين</td></tr>
                ) : filtered.map(sub => (
                  <tr key={sub.id} className="border-b border-white/5 hover:bg-white/2 transition-colors group">
                    <td className="px-3 py-3">
                      <button onClick={() => toggle(sub.id)}>
                        {selectedIds.has(sub.id) ? <CheckSquare className="w-4 h-4" style={{ color: A }} /> : <Square className="w-4 h-4 text-white/30" />}
                      </button>
                    </td>
                    {/* Name */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="font-medium text-white text-sm">{sub.subscriberName || <span className="text-white/30">—</span>}</p>
                    </td>
                    {/* Phone */}
                    <td className="px-3 py-3 text-white/60 text-xs font-mono whitespace-nowrap">{sub.phone || <span className="text-white/20">—</span>}</td>
                    {/* Email */}
                    <td className="px-3 py-3 text-white/50 text-xs max-w-[150px]">
                      <span className="truncate block">{sub.email || <span className="text-white/20">—</span>}</span>
                    </td>
                    {/* UDID */}
                    <td className="px-3 py-3 text-white/40 text-xs font-mono max-w-[140px]">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{sub.udid ? sub.udid.slice(0, 14) + "…" : "—"}</span>
                        {sub.udid && (
                          <button onClick={() => { navigator.clipboard.writeText(sub.udid!); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-white">
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    {/* Device */}
                    <td className="px-3 py-3 text-white/60 text-xs whitespace-nowrap">{sub.deviceType || "—"}</td>
                    {/* Plan */}
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${A}20`, color: A }}>
                        {sub.planNameAr || sub.planName || "—"}
                      </span>
                    </td>
                    {/* Source type */}
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {sub.sourceType === "enrollment_request"
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/15 text-purple-400">طلب اشتراك</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs bg-white/8 text-white/40">كود اشتراك</span>}
                    </td>
                    {/* Group */}
                    <td className="px-3 py-3 text-white/60 text-xs whitespace-nowrap">{sub.groupName || "—"}</td>
                    {/* Status */}
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${sub.isActive === "true" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {sub.isActive === "true" ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    {/* Balance */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <button
                        onClick={() => setBalanceSub(sub)}
                        className="flex items-center gap-1 text-xs font-bold hover:opacity-80 transition-opacity"
                        style={{ color: sub.balance > 0 ? "#9fbcff" : "#ffffff40" }}
                        title="إدارة الرصيد"
                      >
                        <Wallet className="w-3 h-3" />
                        {(sub.balance || 0).toLocaleString("ar-IQ")}
                      </button>
                    </td>
                    {/* Date */}
                    <td className="px-3 py-3 text-white/40 text-xs whitespace-nowrap">
                      {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString("ar-IQ") : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Toggle active/suspend */}
                        <button
                          title={sub.isActive === "true" ? "إيقاف الاشتراك" : "تفعيل الاشتراك"}
                          onClick={() => handleToggleActive(sub)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            sub.isActive === "true"
                              ? "text-orange-400/60 hover:text-orange-400 hover:bg-orange-500/10"
                              : "text-green-400/60 hover:text-green-400 hover:bg-green-500/10"
                          }`}
                        >
                          {sub.isActive === "true"
                            ? <PauseCircle className="w-3.5 h-3.5" />
                            : <PlayCircle className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          title="إرسال رسالة"
                          onClick={() => setNotifySub(sub)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-[#9fbcff] hover:bg-[#9fbcff]/10"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="إدارة الرصيد"
                          onClick={() => setBalanceSub(sub)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-[#9fbcff] hover:bg-[#9fbcff]/10"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditSub(sub); setModal("edit"); }}
                          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(modal === "add" || modal === "edit") && (
        <SubModal
          sub={modal === "edit" ? editSub! : undefined}
          plans={plans}
          onClose={() => { setModal(null); setEditSub(null); }}
          onSaved={fetchData}
        />
      )}
      {notifySub && <NotifyModal sub={notifySub} onClose={() => setNotifySub(null)} />}
      {balanceSub && (
        <BalanceModal
          sub={balanceSub}
          onClose={() => setBalanceSub(null)}
          onChanged={fetchData}
        />
      )}
    </AdminLayout>
  );
}
