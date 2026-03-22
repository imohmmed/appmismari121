import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Plus, Loader2, RefreshCw, X, Eye, EyeOff,
  Smartphone, Tablet, Monitor, Key, Mail,
  Shield, Trash2, Edit2, Check, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Zap, Info,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

const IOS_LIMIT = 100;
const MAC_LIMIT = 100;
const IPAD_LIMIT = 100;
const IPHONE_TOTAL = IOS_LIMIT + MAC_LIMIT;

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    headers: { "x-admin-token": token, "Content-Type": "application/json" },
    ...opts,
  });
  return res;
}

interface GroupRecord {
  id: number;
  certName: string;
  issuerId: string;
  keyId: string;
  privateKey: string;
  email: string;
  createdAt: string;
  iosCount: number;
  macCount: number;
  ipadCount: number;
  pendingCount: number;
  activeCount: number;
  totalDevices: number;
}

interface Device {
  id: number;
  code: string;
  udid: string | null;
  phone: string | null;
  subscriberName: string | null;
  deviceType: string | null;
  applePlatform: string | null;
  appleStatus: string | null;
  isActive: string;
  createdAt: string;
}

const emptyForm = { certName: "", issuerId: "", keyId: "", privateKey: "", email: "" };

// ─── Platform Badge ──────────────────────────────────────────────────────────
function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-white/20 text-xs">—</span>;
  const map: Record<string, { label: string; color: string; icon: JSX.Element }> = {
    IOS: { label: "IOS", color: "#22c55e", icon: <Smartphone className="w-3 h-3" /> },
    MAC: { label: "MAC ⚡", color: "#f59e0b", icon: <Monitor className="w-3 h-3" /> },
    IPAD_OS: { label: "iPadOS", color: A, icon: <Tablet className="w-3 h-3" /> },
  };
  const cfg = map[platform] || { label: platform, color: "#ffffff40", icon: null };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold"
      style={{ background: `${cfg.color}20`, color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function AppleStatusBadge({ status }: { status: string | null }) {
  if (status === "ENABLED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400">
        <Check className="w-3 h-3" /> ENABLED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400">
      <Clock className="w-3 h-3" /> PROCESSING
    </span>
  );
}

// ─── Slot Bar ────────────────────────────────────────────────────────────────
function SlotBar({ icon, label, used, limit, color, sublabel }:
  { icon: JSX.Element; label: string; used: number; limit: number; color: string; sublabel?: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span className="text-white/60 text-xs">{label}</span>
          {sublabel && <span className="text-white/25 text-xs">{sublabel}</span>}
        </div>
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {used}<span className="text-white/25">/{limit}</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Devices Modal ───────────────────────────────────────────────────────────
function DevicesModal({ group, onClose }: { group: GroupRecord; onClose: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch(`/admin/groups/${group.id}/devices`)
      .then(r => r.json())
      .then(d => { setDevices(d.devices || []); setLoading(false); });
  }, [group.id]);

  const iphones = devices.filter(d => d.deviceType?.includes("iPhone") || d.applePlatform === "IOS" || d.applePlatform === "MAC");
  const ipads = devices.filter(d => d.deviceType?.includes("iPad") || d.applePlatform === "IPAD_OS");
  const iosSlots = devices.filter(d => d.applePlatform === "IOS").length;
  const macSlots = devices.filter(d => d.applePlatform === "MAC").length;
  const ipadSlots = devices.filter(d => d.applePlatform === "IPAD_OS").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-white font-bold text-sm">{group.certName} — خريطة الأجهزة</h3>
            <p className="text-white/40 text-xs mt-0.5">{devices.length} جهاز مسجل</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slot Summary */}
        <div className="px-5 py-4 border-b border-white/5 grid grid-cols-3 gap-3">
          <div className="bg-[#0a0a0a] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Smartphone className="w-3.5 h-3.5 text-green-400" />
              <span className="text-white/40 text-xs">آيفون IOS</span>
            </div>
            <p className="text-green-400 font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{iosSlots}</p>
            <p className="text-white/25 text-xs">/ {IOS_LIMIT} مقعد</p>
          </div>
          <div className="bg-[#0a0a0a] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Monitor className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-white/40 text-xs">آيفون MAC ⚡</span>
            </div>
            <p className="text-yellow-400 font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{macSlots}</p>
            <p className="text-white/25 text-xs">/ {MAC_LIMIT} مقعد</p>
          </div>
          <div className="bg-[#0a0a0a] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Tablet className="w-3.5 h-3.5" style={{ color: A }} />
              <span className="text-white/40 text-xs">آيباد</span>
            </div>
            <p className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif", color: A }}>{ipadSlots}</p>
            <p className="text-white/25 text-xs">/ {IPAD_LIMIT} مقعد</p>
          </div>
        </div>

        {/* MAC Bypass Info */}
        {macSlots > 0 && (
          <div className="mx-5 mt-3 flex items-start gap-2 bg-yellow-500/8 border border-yellow-500/15 rounded-xl px-3 py-2.5">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 text-xs font-semibold">تجاوز الحد النشط (MAC Bypass)</p>
              <p className="text-yellow-400/60 text-xs mt-0.5">
                {macSlots} جهاز آيفون مسجل كـ MAC للتحايل على حد الـ 100. إجمالي آيفون: {iosSlots + macSlots}/200.
              </p>
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 mt-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : devices.length === 0 ? (
            <div className="py-12 text-center">
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-white/20" />
              <p className="text-white/30 text-sm">لا توجد أجهزة في هذه الشهادة</p>
            </div>
          ) : (
            <table className="w-full text-sm text-right">
              <thead className="bg-[#0a0a0a] border-b border-white/5 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-white/30 text-xs font-medium">#</th>
                  <th className="px-4 py-2.5 text-white/30 text-xs font-medium">المشترك</th>
                  <th className="px-4 py-2.5 text-white/30 text-xs font-medium">الجهاز</th>
                  <th className="px-4 py-2.5 text-white/30 text-xs font-medium">منصة أبل</th>
                  <th className="px-4 py-2.5 text-white/30 text-xs font-medium">حالة أبل</th>
                  <th className="px-4 py-2.5 text-white/30 text-xs font-medium">تاريخ الإضافة</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d, i) => (
                  <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-2.5 text-white/25 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-white/80 text-xs font-medium">{d.subscriberName || d.phone || "—"}</div>
                      {d.udid && <div className="text-white/25 text-xs font-mono mt-0.5 truncate max-w-[160px]" title={d.udid}>{d.udid.substring(0, 20)}…</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-white/50 text-xs">{d.deviceType || "—"}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <PlatformBadge platform={d.applePlatform} />
                    </td>
                    <td className="px-4 py-2.5">
                      <AppleStatusBadge status={d.appleStatus} />
                    </td>
                    <td className="px-4 py-2.5 text-white/25 text-xs">
                      {new Date(d.createdAt).toLocaleDateString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add/Edit Group Modal ─────────────────────────────────────────────────────
function GroupFormModal({
  group, onClose, onSaved,
}: { group?: GroupRecord; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!group;
  const [form, setForm] = useState({
    certName: group?.certName || "",
    issuerId: group?.issuerId || "",
    keyId: group?.keyId || "",
    privateKey: "",
    email: group?.email || "",
  });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setError("");
    if (!isEdit && (!form.certName.trim() || !form.issuerId.trim() || !form.keyId.trim() || !form.privateKey.trim())) {
      setError("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    setSaving(true);
    const res = await adminFetch(isEdit ? `/admin/groups/${group!.id}` : "/admin/groups", {
      method: isEdit ? "PUT" : "POST",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "حدث خطأ"); return; }
    onSaved();
    onClose();
  };

  const inp = "w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#9fbcff]/50 transition-colors";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-white font-bold text-sm">{isEdit ? "تعديل المجموعة" : "إضافة مجموعة جديدة"}</h3>
            <p className="text-white/40 text-xs mt-0.5">
              {isEdit ? group!.certName : "شهادة Apple Developer • 200 آيفون + 100 آيباد"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">اسم الشهادة (_id) {!isEdit && <span className="text-red-400">*</span>}</label>
            <input value={form.certName} onChange={set("certName")} className={inp} placeholder="مثال: G1_Mohammed_Cert" />
            <p className="text-white/25 text-xs mt-1">معرف داخلي فريد — يُربط به جميع مشتركي هذه الشهادة</p>
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Issuer ID {!isEdit && <span className="text-red-400">*</span>}</label>
            <input value={form.issuerId} onChange={set("issuerId")} className={`${inp} font-mono text-xs`}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" dir="ltr" />
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Key ID {!isEdit && <span className="text-red-400">*</span>}</label>
            <input value={form.keyId} onChange={set("keyId")} className={`${inp} font-mono text-xs`}
              placeholder="XXXXXXXXXX" dir="ltr" />
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1.5 block">
              Private Key (.p8) {!isEdit && <span className="text-red-400">*</span>}
              {isEdit && <span className="text-white/25 mr-1">• اتركه فارغاً للإبقاء على الحالي</span>}
            </label>
            <div className="relative">
              <textarea value={form.privateKey} onChange={set("privateKey")} rows={showKey ? 5 : 3}
                className={`${inp} font-mono text-xs resize-none`}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" dir="ltr" />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute top-2 left-2 p-1 rounded text-white/30 hover:text-white/70 transition-colors">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1.5 block">البريد الإلكتروني</label>
            <input value={form.email} onChange={set("email")} className={inp} type="email" dir="ltr"
              placeholder="dev@example.com" />
          </div>

          {/* Capacity Info */}
          <div className="bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
            <p className="text-white/50 text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> طاقة الشهادة
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: <Smartphone className="w-3.5 h-3.5 mx-auto mb-1 text-green-400" />, label: "آيفون IOS", val: "100" },
                { icon: <Monitor className="w-3.5 h-3.5 mx-auto mb-1 text-yellow-400" />, label: "آيفون MAC⚡", val: "100" },
                { icon: <Tablet className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: A }} />, label: "آيباد", val: "100" },
              ].map(s => (
                <div key={s.label}>
                  {s.icon}
                  <p className="text-white font-bold text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>{s.val}</p>
                  <p className="text-white/30 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-white/25 text-xs mt-2 text-center">= 200 آيفون + 100 آيباد = 300 جهاز إجمالاً</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/8 flex gap-3">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#0a0a0a] transition-opacity disabled:opacity-50"
            style={{ background: A }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isEdit ? "حفظ التعديلات" : "حفظ المجموعة"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group, onDelete, onEdit, onViewDevices }: {
  group: GroupRecord;
  onDelete: () => void;
  onEdit: () => void;
  onViewDevices: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const iphoneTotal = group.iosCount + group.macCount;
  const iphonePct = Math.min(100, Math.round((iphoneTotal / IPHONE_TOTAL) * 100));
  const ipadPct = Math.min(100, Math.round((group.ipadCount / IPAD_LIMIT) * 100));

  const iphoneBarColor = iphonePct >= 90 ? "#ef4444" : iphonePct >= 70 ? "#f59e0b" : "#22c55e";
  const ipadBarColor = ipadPct >= 90 ? "#ef4444" : ipadPct >= 70 ? "#f59e0b" : A;

  const bypassActive = group.macCount > 0;
  const totalCapacity = IPHONE_TOTAL + IPAD_LIMIT;
  const totalUsed = iphoneTotal + group.ipadCount;
  const totalPct = Math.round((totalUsed / totalCapacity) * 100);

  const handleDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف "${group.certName}"؟`)) return;
    setDeleting(true);
    await adminFetch(`/admin/groups/${group.id}`, { method: "DELETE" });
    onDelete();
  };

  return (
    <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden flex flex-col" dir="rtl">
      <div className="p-5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
              style={{ background: `${A}15` }}>
              <Shield className="w-5 h-5" style={{ color: A }} />
              {bypassActive && (
                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-black" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-sm truncate">{group.certName}</h3>
              {group.email && <p className="text-white/30 text-xs truncate">{group.email}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg text-white/30 hover:text-[#9fbcff] hover:bg-[#9fbcff]/10 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* MAC Bypass Alert */}
        {bypassActive && (
          <div className="flex items-center gap-2 bg-yellow-500/8 border border-yellow-500/15 rounded-xl px-3 py-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-yellow-400 text-xs font-medium">MAC Bypass نشط — {group.macCount} جهاز إضافي</span>
          </div>
        )}

        {/* iPhone bars */}
        <div className="space-y-2.5 mb-4">
          <SlotBar
            icon={<Smartphone className="w-3.5 h-3.5" />}
            label="آيفون (IOS)"
            used={group.iosCount}
            limit={IOS_LIMIT}
            color="#22c55e"
          />
          <SlotBar
            icon={<Monitor className="w-3.5 h-3.5" />}
            label="آيفون (MAC Bypass)"
            used={group.macCount}
            limit={MAC_LIMIT}
            color="#f59e0b"
            sublabel="⚡"
          />
          <SlotBar
            icon={<Tablet className="w-3.5 h-3.5" />}
            label="آيباد"
            used={group.ipadCount}
            limit={IPAD_LIMIT}
            color={A}
          />
        </div>

        {/* Totals Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "آيفون", val: iphoneTotal, max: IPHONE_TOTAL, color: iphoneBarColor },
            { label: "آيباد", val: group.ipadCount, max: IPAD_LIMIT, color: ipadBarColor },
            { label: "نشط", val: group.activeCount, max: group.totalDevices, color: "#22c55e" },
            { label: "معلق", val: group.pendingCount, max: group.totalDevices, color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} className="bg-[#0a0a0a] rounded-xl p-2 text-center">
              <p className="font-bold text-base leading-tight" style={{ fontFamily: "Outfit, sans-serif", color: s.color }}>{s.val}</p>
              <p className="text-white/30 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Overall capacity bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/40">الاستخدام الإجمالي</span>
            <span className="text-white/60 font-mono">{totalUsed}/{totalCapacity} ({totalPct}%)</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden flex gap-0.5">
            <div className="h-full bg-green-500/80 transition-all duration-700 rounded-r-full"
              style={{ width: `${Math.round((group.iosCount / totalCapacity) * 100)}%` }} />
            <div className="h-full bg-yellow-400/80 transition-all duration-700"
              style={{ width: `${Math.round((group.macCount / totalCapacity) * 100)}%` }} />
            <div className="h-full transition-all duration-700 rounded-l-full"
              style={{ width: `${Math.round((group.ipadCount / totalCapacity) * 100)}%`, background: A }} />
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-white/25 text-xs"><span className="w-2 h-2 rounded-sm bg-green-500/80 inline-block" />IOS</span>
            <span className="flex items-center gap-1 text-white/25 text-xs"><span className="w-2 h-2 rounded-sm bg-yellow-400/80 inline-block" />MAC⚡</span>
            <span className="flex items-center gap-1 text-white/25 text-xs"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: A }} />iPad</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onViewDevices}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{ background: `${A}15`, color: A }}>
            <Smartphone className="w-3.5 h-3.5" />
            خريطة الأجهزة
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            التفاصيل
          </button>
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="border-t border-white/5 px-5 py-4 bg-[#0d0d0d] space-y-3">
          <div className="space-y-0">
            <h4 className="text-white/50 text-xs font-semibold mb-2 flex items-center gap-2">
              <Key className="w-3.5 h-3.5" /> المعلومات التقنية
            </h4>
            {[
              { label: "اسم الشهادة", value: group.certName },
              { label: "Issuer ID", value: group.issuerId, mono: true },
              { label: "Key ID", value: group.keyId, mono: true },
              { label: "Private Key", value: "••••••••••••••", mono: true },
              { label: "البريد", value: group.email || "—" },
              { label: "تاريخ الإضافة", value: new Date(group.createdAt).toLocaleDateString("ar-SA") },
            ].map(r => (
              <div key={r.label} className="flex items-start justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                <span className="text-white/30 text-xs shrink-0">{r.label}</span>
                <span className={`text-white/60 text-xs text-left break-all ${r.mono ? "font-mono" : ""}`}>{r.value}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/5">
            <h4 className="text-white/50 text-xs font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> منطق التسجيل الذكي
            </h4>
            <div className="space-y-2 text-xs text-white/30 leading-relaxed">
              <div className="flex items-start gap-2">
                <Smartphone className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                <p>آيفون 1-100 → مسجل كـ <span className="text-green-400 font-mono">IOS</span> (تسجيل عادي)</p>
              </div>
              <div className="flex items-start gap-2">
                <Monitor className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                <p>آيفون 101-200 → مسجل كـ <span className="text-yellow-400 font-mono">MAC</span> (تجاوز الحد)</p>
              </div>
              <div className="flex items-start gap-2">
                <Tablet className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: A }} />
                <p>آيباد 1-100 → مسجل كـ <span className="font-mono" style={{ color: A }}>IPAD_OS</span></p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <p>عند امتلاء الشهادة (300 جهاز) → النظام ينتقل تلقائياً للشهادة التالية</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminGroups() {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupRecord | null>(null);
  const [devicesGroup, setDevicesGroup] = useState<GroupRecord | null>(null);

  const fetchGroups = async () => {
    setLoading(true);
    const res = await adminFetch("/admin/groups");
    const d = await res.json();
    setGroups(d?.groups || []);
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const totalIPhone = groups.reduce((s, g) => s + g.iosCount + g.macCount, 0);
  const totalIPad = groups.reduce((s, g) => s + g.ipadCount, 0);
  const totalPending = groups.reduce((s, g) => s + g.pendingCount, 0);
  const totalCapacity = groups.length * (IPHONE_TOTAL + IPAD_LIMIT);

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">المجموعات</h2>
            <p className="text-white/40 text-xs mt-0.5">
              إدارة شهادات Apple Developer • 200 آيفون + 100 آيباد لكل شهادة
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchGroups} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#0a0a0a] transition-opacity hover:opacity-90"
              style={{ background: A }}>
              <Plus className="w-4 h-4" />
              إضافة مجموعة
            </button>
          </div>
        </div>

        {/* Stats */}
        {groups.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "شهادات", val: groups.length, color: A },
              { label: "آيفون كلي", val: totalIPhone, max: groups.length * IPHONE_TOTAL, color: "#22c55e" },
              { label: "آيباد كلي", val: totalIPad, max: groups.length * IPAD_LIMIT, color: "#8b5cf6" },
              { label: "انتظار تفعيل", val: totalPending, color: "#f59e0b" },
              { label: "طاقة كلية", val: totalCapacity, color: "#64748b" },
            ].map(s => (
              <div key={s.label} className="bg-[#111111] border border-white/8 rounded-xl p-4">
                <p className="text-xl font-black leading-tight" style={{ fontFamily: "Outfit, sans-serif", color: s.color }}>{s.val}</p>
                {"max" in s && <p className="text-white/20 text-xs" style={{ fontFamily: "Outfit, sans-serif" }}>/ {s.max}</p>}
                <p className="text-white/40 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center bg-[#111111] rounded-2xl border border-white/8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${A}15` }}>
              <Shield className="w-7 h-7" style={{ color: A }} />
            </div>
            <p className="text-white/50 text-sm font-medium mb-1">لا توجد مجموعات بعد</p>
            <p className="text-white/25 text-xs mb-2">كل شهادة تدعم: 200 آيفون + 100 آيباد = 300 جهاز</p>
            <p className="text-white/15 text-xs mb-5">آيفون 1-100: IOS عادي • آيفون 101-200: MAC Bypass ⚡</p>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0a0a0a]"
              style={{ background: A }}>
              <Plus className="w-4 h-4" />
              إضافة مجموعة
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map(g => (
              <GroupCard
                key={g.id}
                group={g}
                onDelete={fetchGroups}
                onEdit={() => setEditGroup(g)}
                onViewDevices={() => setDevicesGroup(g)}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && <GroupFormModal onClose={() => setShowAdd(false)} onSaved={fetchGroups} />}
      {editGroup && <GroupFormModal group={editGroup} onClose={() => setEditGroup(null)} onSaved={fetchGroups} />}
      {devicesGroup && <DevicesModal group={devicesGroup} onClose={() => setDevicesGroup(null)} />}
    </AdminLayout>
  );
}
