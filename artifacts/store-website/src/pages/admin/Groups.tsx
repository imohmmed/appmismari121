import React, { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Plus, Loader2, RefreshCw, X, Eye, EyeOff,
  Smartphone, Tablet, Monitor, Key,
  Shield, Trash2, Edit2, Check, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Zap, Info, Code2, Copy,
  RotateCcw, CheckCircle, FlaskConical, Upload,
  Calendar, Users, Tag, Globe, Bell, CheckCircle2,
  XCircle, FileText, Download, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

// Safety limits (matching backend: 98 instead of 100)
const IOS_LIMIT = 98;
const MAC_LIMIT = 98;
const IPAD_LIMIT = 98;
const IPHONE_TOTAL = IOS_LIMIT + MAC_LIMIT;

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    headers: { "x-admin-token": token, "Content-Type": "application/json" },
    ...opts,
  });
  return res;
}

async function adminUpload(path: string, formData: FormData) {
  const token = localStorage.getItem("adminToken") || "";
  return fetch(`${API}/api${path}`, {
    method: "POST",
    headers: { "x-admin-token": token },
    body: formData,
  });
}

interface GroupRecord {
  id: number;
  certName: string;
  groupType: string;
  issuerId: string;
  keyId: string;
  privateKey: string;
  email: string;
  createdAt: string;
  lastSyncAt: string | null;
  lastSyncNote: string | null;
  iphoneOfficialCount: number;
  iphoneMacCount: number;
  ipadCount: number;
  pendingCount: number;
  activeCount: number;
  totalDevices: number;
  // Test certificate fields
  certCommonName?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  certExpiresAt?: string | null;
  bundleId?: string | null;
  provisionName?: string | null;
  provisionedUdidCount?: number | null;
  // Store IPA
  storeIpaPath?: string | null;
}

interface AnalysisResult {
  mobileprovision?: {
    name: string;
    teamId: string;
    teamName: string;
    appIdName: string;
    bundleId: string;
    expirationDate: string | null;
    creationDate: string | null;
    udidCount: number;
    udids: string[];
    isWildcard: boolean;
    platform: unknown;
    entitlements: {
      pushNotifications: boolean;
      iCloud: boolean;
      groupContainers: boolean;
      appGroups: string[];
      apsEnvironment: string | null;
    };
  };
  mobileprovisionError?: string;
  p12?: {
    commonName: string;
    issuer: string;
    notBefore: string;
    notAfter: string;
  };
  p12Error?: string;
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

// ─── Apple API Request Code Templates ────────────────────────────────────────
const CODE_TEMPLATES = {
  IOS: (udid: string, name: string) => `// ✅ آيفون رسمي (مقعد 1-${IOS_LIMIT})
// يُستخدم عندما: iphoneOfficialCount < ${IOS_LIMIT}

POST https://api.appstoreconnect.apple.com/v1/devices
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "data": {
    "type": "devices",
    "attributes": {
      "name": "${name || "Mismari_iPhone_1"}",
      "udid": "${udid || "00008030-001234567890002E"}",
      "platform": "IOS"
    }
  }
}

// النتيجة في أبل:
// platform: IOS  |  deviceClass: IPHONE
// يُحسب في: خانة iPhone الرسمية (0-100)`,

  MAC: (udid: string, name: string) => `// ⚡ آيفون كـ MAC (مقعد ${IOS_LIMIT + 1}-${IPHONE_TOTAL}) — MAC Bypass
// يُستخدم عندما: المستخدم رقم 99-196 (بعد امتلاء خانة IOS)
// القاعدة: نفس UDID لا يُسجَّل مرتين — كل شخص إما IOS أو MAC، ليس كليهما
// أبل تعطي خطأ 409 Conflict إذا حاولت تسجيل UDID موجود مسبقاً

POST https://api.appstoreconnect.apple.com/v1/devices
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "data": {
    "type": "devices",
    "attributes": {
      "name": "${name || "Mismari_iPhone_MAC_101"}",
      "udid": "${udid || "00008030-001234567890002E"}",
      "platform": "MAC"   // ✅ القيمة الصحيحة عند أبل هي MAC وليس MAC_OS
    }
  }
}

// ما تعيده أبل عند النجاح (مهم! احفظ الـ id):
// {
//   "data": {
//     "id": "APPLE_DEVICE_ID_HERE",   ← احفظه في DB (appleDeviceId)
//     "attributes": { "platform": "MAC", "status": "ENABLED" }
//   }
// }
// لحذف الجهاز لاحقاً: DELETE /v1/devices/{appleDeviceId}
// أبل لا تقبل UDID للحذف — فقط الـ id الخاص بها`,

  IPAD: (udid: string, name: string) => `// 🟦 آيباد رسمي (مقعد 1-${IPAD_LIMIT})
// يُستخدم عندما: ipadCount < ${IPAD_LIMIT}
// الآيباد يُسجَّل كـ IOS أيضاً — خط منفصل عن الآيفون

POST https://api.appstoreconnect.apple.com/v1/devices
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "data": {
    "type": "devices",
    "attributes": {
      "name": "${name || "Mismari_iPad_1"}",
      "udid": "${udid || "00008112-000A1234B5678901"}",
      "platform": "IOS"      // أبل تستخدم IOS للآيباد أيضاً
    }
  }
}

// النتيجة في أبل:
// platform: IOS  |  deviceClass: IPAD
// يُحسب في: خانة iPad المنفصلة (0-100)`,

  LOGIC: () => `// 🧠 منطق Pre-Flight Check الكامل (مضاد للرصاص)
// يعمل محلياً من DB — لا يتصل بأبل هنا
// كل شخص يحصل على خانة واحدة فقط (IOS أو MAC) — لا تكرار

async function registerDevice(udid, deviceType, certId) {
  // ─── 1. فحص UDID مكرر (Safety Lock) ────────────────────────
  const duplicate = await db.findByUDID(certId, udid);
  if (duplicate) {
    // نفس الشهادة + نفس UDID → لا تستهلك مقعداً
    // فقط حدّث Provisioning Profile للشخص الموجود
    return { isDuplicate: true, platform: duplicate.platform };
  }

  // ─── 2. قراءة العدادات من DB المحلية ───────────────────────
  const stats = await db.getStats(certId);
  const LIMIT = ${IOS_LIMIT}; // حد الأمان (98 بدل 100)

  let applePayload;

  if (deviceType === "iPhone") {
    const totalIphones = stats.iphone_official + stats.iphone_mac;

    if (totalIphones < LIMIT) {
      // المستخدم رقم 1-98 → IOS رسمي
      applePayload = { platform: "IOS" };
      await db.markAs(sub, "IOS"); // internal_status = OFFICIAL

    } else if (totalIphones < LIMIT * 2) {
      // المستخدم رقم 99-196 → MAC bypass
      // ⚠️ UDID مختلف تماماً (شخص جديد) — ليس نفس الشخص مرتين
      applePayload = { platform: "MAC" }; // القيمة الصحيحة عند أبل
      await db.markAs(sub, "MAC"); // internal_status = MAC_TRICK

    } else {
      return { platform: "FULL" }; // 🚫 قفل → انتقل لشهادة جديدة
    }
  }

  // ─── 3. إرسال الطلب لأبل ────────────────────────────────────
  const appleResponse = await apple.registerDevice({
    name: generateName(deviceType, stats),
    udid: udid,
    ...applePayload
  });

  // ─── 4. احفظ Apple Device ID الذي أعادته أبل ────────────────
  // مطلوب لاحقاً لحذف الجهاز عند انتهاء الاشتراك
  // أبل لا تقبل UDID للحذف — فقط الـ id الخاص بها
  const appleDeviceId = appleResponse.data.id; // مثال: "APPLE123456789"
  await db.saveAppleDeviceId(sub.id, appleDeviceId);

  // ─── 5. حدّث العداد المحلي فوراً (+1) ───────────────────────
  await db.incrementCount(certId, applePayload.platform);
}

// ─── حذف جهاز (عند انتهاء الاشتراك) ───────────────────────────
async function removeDevice(subId) {
  const sub = await db.getSubscription(subId);
  // استخدم الـ appleDeviceId المخزن — وليس الـ UDID
  await apple.delete(\`/v1/devices/\${sub.appleDeviceId}\`);
  await db.decrementCount(certId, sub.platform); // (-1) من العداد
}`,
};

// ─── Code Modal ───────────────────────────────────────────────────────────────
function CodeModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"IOS" | "MAC" | "IPAD" | "LOGIC">("LOGIC");
  const [copied, setCopied] = useState(false);

  const code = tab === "LOGIC" ? CODE_TEMPLATES.LOGIC() :
    tab === "IOS" ? CODE_TEMPLATES.IOS("UDID_IPHONE_HERE", "Mismari_iPhone_1") :
    tab === "MAC" ? CODE_TEMPLATES.MAC("UDID_IPHONE_HERE", "Mismari_iPhone_MAC_101") :
    CODE_TEMPLATES.IPAD("UDID_IPAD_HERE", "Mismari_iPad_1");

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { key: "LOGIC", label: "منطق القرار", color: "#a78bfa" },
    { key: "IOS", label: "آيفون IOS", color: "#22c55e" },
    { key: "MAC", label: "آيفون MAC⚡", color: "#f59e0b" },
    { key: "IPAD", label: "آيباد", color: A },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4" style={{ color: A }} />
            <h3 className="text-white font-bold text-sm">كود طلبات Apple API</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-2 border-b border-white/5">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={tab === t.key
                ? { background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}30` }
                : { color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
              }
            >
              {t.label}
            </button>
          ))}
          <button onClick={copy}
            className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ color: copied ? "#22c55e" : "rgba(255,255,255,0.35)" }}>
            {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "تم النسخ" : "نسخ"}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words"
            style={{ color: "rgba(255,255,255,0.75)" }}>
            {code.split("\n").map((line, i) => {
              const isComment = line.trim().startsWith("//");
              const isUrl = line.includes("https://");
              const isKey = line.includes('"platform"') || line.includes('"udid"') || line.includes('"name"');
              return (
                <span key={i} className="block">
                  <span style={{
                    color: isComment ? "#6b7280" :
                      isUrl ? "#60a5fa" :
                      isKey ? A :
                      "rgba(255,255,255,0.75)",
                  }}>
                    {line}
                  </span>
                </span>
              );
            })}
          </pre>
        </div>

        <div className="px-5 py-3 border-t border-white/5">
          <p className="text-white/20 text-xs text-center">
            يُستدعى هذا الكود عند: تسجيل مشترك جديد · تحديث يدوي · طلب توقيع فقط
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Platform Badge ───────────────────────────────────────────────────────────
function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-white/20 text-xs">—</span>;
  const map: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
    IOS: { label: "IOS", color: "#22c55e", icon: <Smartphone className="w-3 h-3" /> },
    MAC: { label: "MAC ⚡", color: "#f59e0b", icon: <Monitor className="w-3 h-3" /> },
    IPAD_OS: { label: "iPadOS", color: A, icon: <Tablet className="w-3 h-3" /> },
  };
  const cfg = map[platform] || { label: platform, color: "#ffffff40", icon: null };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold"
      style={{ background: `${cfg.color}20`, color: cfg.color }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function AppleStatusBadge({ status }: { status: string | null }) {
  return status === "ENABLED"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400"><Check className="w-3 h-3" />ENABLED</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400"><Clock className="w-3 h-3" />PROCESSING</span>;
}

// ─── Slot Bar ─────────────────────────────────────────────────────────────────
function SlotBar({ icon, label, used, limit, color, safetyNote }:
  { icon: React.ReactElement; label: string; used: number; limit: number; color: string; safetyNote?: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span className="text-white/55 text-xs">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {safetyNote && <span className="text-white/20 text-xs">{safetyNote}</span>}
          <span className="text-xs font-mono font-bold" style={{ color }}>
            {used}<span className="text-white/20">/{limit}</span>
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
        {/* Safety buffer indicator at 98% */}
        <div className="absolute top-0 right-[2%] h-full w-[1px] bg-white/15" title="حد الأمان" />
      </div>
    </div>
  );
}

// ─── Devices Modal ────────────────────────────────────────────────────────────
function DevicesModal({ group, onClose }: { group: GroupRecord; onClose: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch(`/admin/groups/${group.id}/devices`)
      .then(r => r.json())
      .then(d => { setDevices(d.devices || []); setLoading(false); });
  }, [group.id]);

  const iosSl = devices.filter(d => d.applePlatform === "IOS").length;
  const macSl = devices.filter(d => d.applePlatform === "MAC").length;
  const ipadSl = devices.filter(d => d.applePlatform === "IPAD_OS").length;

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

        <div className="px-5 py-3 border-b border-white/5 grid grid-cols-3 gap-3">
          {[
            { icon: <Smartphone className="w-3.5 h-3.5 text-green-400" />, label: "آيفون IOS", val: iosSl, limit: IOS_LIMIT, color: "#22c55e" },
            { icon: <Monitor className="w-3.5 h-3.5 text-yellow-400" />, label: "آيفون MAC ⚡", val: macSl, limit: MAC_LIMIT, color: "#f59e0b" },
            { icon: <Tablet className="w-3.5 h-3.5" style={{ color: A }} />, label: "آيباد", val: ipadSl, limit: IPAD_LIMIT, color: A },
          ].map(s => (
            <div key={s.label} className="bg-[#0a0a0a] rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">{s.icon}<span className="text-white/40 text-xs">{s.label}</span></div>
              <p className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif", color: s.color }}>{s.val}</p>
              <p className="text-white/20 text-xs">/ {s.limit} مقعد</p>
            </div>
          ))}
        </div>

        {macSl > 0 && (
          <div className="mx-5 mt-3 flex items-start gap-2 bg-yellow-500/8 border border-yellow-500/15 rounded-xl px-3 py-2.5">
            <Zap className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-yellow-400/80 text-xs">
              <strong>MAC Bypass نشط</strong> — {macSl} جهاز آيفون مسجل كـ <code className="bg-yellow-400/10 px-1 rounded">MAC_OS</code> لدى أبل. إجمالي آيفون: {iosSl + macSl}/{IPHONE_TOTAL}
            </p>
          </div>
        )}

        <div className="overflow-y-auto flex-1 mt-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : devices.length === 0 ? (
            <div className="py-12 text-center">
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-white/20" />
              <p className="text-white/30 text-sm">لا توجد أجهزة</p>
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
                  <th className="px-4 py-2.5 text-white/30 text-xs font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d, i) => (
                  <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-2.5 text-white/25 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-white/80 text-xs font-medium">{d.subscriberName || d.phone || "—"}</div>
                      {d.udid && <div className="text-white/25 text-xs font-mono mt-0.5 truncate max-w-[160px]">{d.udid.substring(0, 20)}…</div>}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">{d.deviceType || "—"}</td>
                    <td className="px-4 py-2.5"><PlatformBadge platform={d.applePlatform} /></td>
                    <td className="px-4 py-2.5"><AppleStatusBadge status={d.appleStatus} /></td>
                    <td className="px-4 py-2.5 text-white/25 text-xs">{new Date(d.createdAt).toLocaleDateString("ar-SA")}</td>
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

// ─── Test Group Modal ─────────────────────────────────────────────────────────
function TestGroupModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const p12Ref = useRef<HTMLInputElement>(null);
  const provRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "analyzing" | "results" | "saving">("upload");
  const [p12File, setP12File] = useState<File | null>(null);
  const [provFile, setProvFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [certName, setCertName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAllUdids, setShowAllUdids] = useState(false);

  const analyze = async () => {
    if (!p12File) { setError("يرجى اختيار ملف الشهادة (.p12)"); return; }
    if (!provFile) { setError("يرجى اختيار ملف الوصف (.mobileprovision)"); return; }
    setError("");
    setStep("analyzing");

    const fd = new FormData();
    fd.append("p12", p12File);
    fd.append("mobileprovision", provFile);
    fd.append("password", password);

    try {
      const res = await adminUpload("/admin/groups/test-analyze", fd);
      const data: AnalysisResult = await res.json();
      setResult(data);
      if (data.mobileprovision) setCertName(data.mobileprovision.name || "");
      setStep("results");
    } catch {
      setError("حدث خطأ أثناء التحليل");
      setStep("upload");
    }
  };

  const save = async () => {
    if (!certName.trim()) { toast({ title: "اسم المجموعة مطلوب", variant: "destructive" }); return; }
    setSaving(true);
    setStep("saving");

    const fd = new FormData();
    fd.append("certName", certName.trim());
    fd.append("password", password);
    if (p12File) fd.append("p12", p12File);
    if (provFile) fd.append("mobileprovision", provFile);
    if (result?.mobileprovision) {
      const mp = result.mobileprovision;
      fd.append("certCommonName", result.p12?.commonName || "");
      fd.append("teamId", mp.teamId || "");
      fd.append("teamName", mp.teamName || "");
      fd.append("certExpiresAt", mp.expirationDate || "");
      fd.append("bundleId", mp.bundleId || "");
      fd.append("provisionName", mp.name || "");
      fd.append("udids", JSON.stringify(mp.udids || []));
    }

    try {
      const res = await adminUpload("/admin/groups/test-create", fd);
      if (res.ok) {
        toast({ title: "تم حفظ المجموعة التجريبية بنجاح" });
        onSaved();
        onClose();
      } else {
        const d = await res.json();
        toast({ title: d.error || "حدث خطأ", variant: "destructive" });
        setStep("results");
      }
    } catch {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
      setStep("results");
    }
    setSaving(false);
  };

  const copyUdid = (udid: string) => { navigator.clipboard.writeText(udid); };

  const mp = result?.mobileprovision;
  const p12 = result?.p12;
  const certExpired = mp?.expirationDate ? new Date(mp.expirationDate) < new Date() : false;
  const daysLeft = mp?.expirationDate
    ? Math.ceil((new Date(mp.expirationDate).getTime() - Date.now()) / 86400000)
    : null;

  const inp = "w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#9fbcff]/50 transition-colors";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#f59e0b18" }}>
              <FlaskConical className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">إضافة مجموعة تجريبية</h3>
              <p className="text-white/30 text-xs mt-0.5">
                {step === "upload" ? "رفع شهادة .p12 + ملف .mobileprovision"
                  : step === "analyzing" ? "جاري تحليل الشهادة..."
                  : step === "results" || step === "saving" ? "نتائج التحليل — راجع البيانات قبل الحفظ"
                  : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Upload Step ────────────────────────────────────────────── */}
          {(step === "upload") && (
            <>
              {/* p12 */}
              <div>
                <label className="text-white/60 text-xs mb-2 block flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  ملف الشهادة (.p12) <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => p12Ref.current?.click()}
                  className="w-full border border-dashed border-white/15 rounded-xl py-5 flex flex-col items-center gap-2 hover:border-[#9fbcff]/40 hover:bg-[#9fbcff]/4 transition-all"
                  style={p12File ? { borderColor: "#9fbcff40", background: "#9fbcff06" } : {}}
                >
                  {p12File ? (
                    <>
                      <FileText className="w-6 h-6" style={{ color: A }} />
                      <span className="text-sm font-medium" style={{ color: A }}>{p12File.name}</span>
                      <span className="text-white/30 text-xs">{(p12File.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-white/25" />
                      <span className="text-white/40 text-sm">اضغط لرفع ملف .p12</span>
                    </>
                  )}
                </button>
                <input ref={p12Ref} type="file" accept=".p12" className="hidden"
                  onChange={e => e.target.files?.[0] && setP12File(e.target.files[0])} />
              </div>

              {/* password */}
              <div>
                <label className="text-white/60 text-xs mb-2 block flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  كلمة مرور الشهادة
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="كلمة مرور ملف .p12"
                    className={inp}
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute top-1/2 -translate-y-1/2 left-3 p-1 rounded text-white/30 hover:text-white/70">
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* mobileprovision */}
              <div>
                <label className="text-white/60 text-xs mb-2 block flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  ملف الوصف (.mobileprovision) <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => provRef.current?.click()}
                  className="w-full border border-dashed border-white/15 rounded-xl py-5 flex flex-col items-center gap-2 hover:border-[#9fbcff]/40 hover:bg-[#9fbcff]/4 transition-all"
                  style={provFile ? { borderColor: "#9fbcff40", background: "#9fbcff06" } : {}}
                >
                  {provFile ? (
                    <>
                      <FileText className="w-6 h-6" style={{ color: A }} />
                      <span className="text-sm font-medium" style={{ color: A }}>{provFile.name}</span>
                      <span className="text-white/30 text-xs">{(provFile.size / 1024).toFixed(1)} KB</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-white/25" />
                      <span className="text-white/40 text-sm">اضغط لرفع ملف .mobileprovision</span>
                    </>
                  )}
                </button>
                <input ref={provRef} type="file" accept=".mobileprovision" className="hidden"
                  onChange={e => e.target.files?.[0] && setProvFile(e.target.files[0])} />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}
            </>
          )}

          {/* ── Analyzing ──────────────────────────────────────────────── */}
          {step === "analyzing" && (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-yellow-400/60" />
              <p className="text-white/50 text-sm">جاري تحليل الملفات...</p>
              <p className="text-white/25 text-xs mt-1">استخراج البيانات من الشهادة</p>
            </div>
          )}

          {/* ── Results ────────────────────────────────────────────────── */}
          {(step === "results" || step === "saving") && result && (
            <>
              {/* Status Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 border ${mp ? "bg-green-500/8 border-green-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                  {mp ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <div>
                    <p className={`text-xs font-bold ${mp ? "text-green-400" : "text-red-400"}`}>
                      {mp ? "✓ Mobileprovision" : "✗ Mobileprovision"}
                    </p>
                    <p className="text-white/30 text-xs">{mp ? "تم التحليل بنجاح" : result.mobileprovisionError}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 border ${p12 ? "bg-green-500/8 border-green-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                  {p12 ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <div>
                    <p className={`text-xs font-bold ${p12 ? "text-green-400" : "text-red-400"}`}>
                      {p12 ? "✓ شهادة P12" : "✗ شهادة P12"}
                    </p>
                    <p className="text-white/30 text-xs">{p12 ? "تم فك التشفير" : result.p12Error}</p>
                  </div>
                </div>
              </div>

              {/* Mobileprovision Info */}
              {mp && (
                <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-white/70 text-xs font-bold">ملف الوصف (Provisioning Profile)</span>
                    {mp.isWildcard && (
                      <span className="mr-auto px-2 py-0.5 rounded-full text-xs bg-yellow-500/15 text-yellow-400">Wildcard</span>
                    )}
                  </div>
                  <div className="divide-y divide-white/5 text-xs">
                    {[
                      { icon: <Tag className="w-3 h-3" />, label: "اسم البروفايل", val: mp.name },
                      { icon: <Globe className="w-3 h-3" />, label: "Bundle ID", val: mp.bundleId, mono: true },
                      { icon: <Shield className="w-3 h-3" />, label: "Team ID", val: mp.teamId, mono: true },
                      { icon: <Users className="w-3 h-3" />, label: "Team Name", val: mp.teamName },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between px-4 py-2.5 gap-3">
                        <span className="flex items-center gap-1.5 text-white/30 shrink-0">{r.icon}{r.label}</span>
                        <span className={`text-white/75 text-left break-all ${r.mono ? "font-mono" : ""}`}>{r.val || "—"}</span>
                      </div>
                    ))}
                    {/* Expiration */}
                    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <span className="flex items-center gap-1.5 text-white/30 shrink-0">
                        <Calendar className="w-3 h-3" />تاريخ الانتهاء
                      </span>
                      <span className={`font-medium ${certExpired ? "text-red-400" : daysLeft && daysLeft < 30 ? "text-yellow-400" : "text-green-400"}`}>
                        {mp.expirationDate
                          ? new Date(mp.expirationDate).toLocaleDateString("ar-SA")
                          : "—"}
                        {daysLeft !== null && !certExpired && (
                          <span className="text-white/30 font-normal mr-1">({daysLeft} يوم)</span>
                        )}
                        {certExpired && <span className="mr-1">(منتهية!)</span>}
                      </span>
                    </div>
                    {/* Entitlements */}
                    <div className="px-4 py-2.5">
                      <p className="text-white/30 mb-2 flex items-center gap-1.5">
                        <Bell className="w-3 h-3" />الصلاحيات (Entitlements)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "Push Notifications", active: mp.entitlements.pushNotifications },
                          { label: "iCloud", active: mp.entitlements.iCloud },
                          { label: "App Groups", active: mp.entitlements.groupContainers },
                        ].map(e => (
                          <span key={e.label}
                            className={`px-2 py-0.5 rounded-full text-xs ${e.active ? "bg-green-500/15 text-green-400" : "bg-white/5 text-white/20"}`}>
                            {e.active ? "✓" : "✗"} {e.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* P12 Info */}
              {p12 && (
                <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                    <Key className="w-3.5 h-3.5" style={{ color: A }} />
                    <span className="text-white/70 text-xs font-bold">شهادة P12 (الهوية الرقمية)</span>
                  </div>
                  <div className="divide-y divide-white/5 text-xs">
                    {[
                      { label: "الاسم (CN)", val: p12.commonName },
                      { label: "الجهة المُصدِرة", val: p12.issuer },
                      { label: "تاريخ الإصدار", val: p12.notBefore },
                      { label: "تاريخ الانتهاء", val: p12.notAfter },
                    ].map(r => (
                      <div key={r.label} className="flex items-start justify-between px-4 py-2.5 gap-3">
                        <span className="text-white/30 shrink-0">{r.label}</span>
                        <span className="text-white/75 text-left break-all font-mono text-xs">{r.val || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UDIDs Section */}
              {mp && mp.udidCount > 0 && (
                <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-white/70 text-xs font-bold">الأجهزة المُدرَجة في البروفايل</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: `${A}20`, color: A }}>
                      {mp.udidCount} جهاز
                    </span>
                  </div>
                  <div className="p-2 max-h-48 overflow-y-auto">
                    {(showAllUdids ? mp.udids : mp.udids.slice(0, 8)).map((udid, i) => (
                      <div key={udid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/3 group">
                        <span className="text-white/15 text-xs w-5 shrink-0 text-center">{i + 1}</span>
                        <span className="font-mono text-xs text-white/45 flex-1 truncate">{udid}</span>
                        <button onClick={() => copyUdid(udid)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-white/30 hover:text-white transition-all">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {mp.udids.length > 8 && (
                      <button onClick={() => setShowAllUdids(v => !v)}
                        className="w-full py-2 text-xs text-center transition-colors"
                        style={{ color: A }}>
                        {showAllUdids ? "إخفاء" : `عرض ${mp.udids.length - 8} UDID إضافي`}
                      </button>
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t border-white/5 bg-yellow-500/4">
                    <p className="text-yellow-400/70 text-xs flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      هذه الأجهزة لن تُضاف تلقائياً للمشتركين — يمكنك إضافتهم يدوياً لاحقاً
                    </p>
                  </div>
                </div>
              )}

              {/* Group Name Input for saving */}
              <div className="border-t border-white/8 pt-4">
                <label className="text-white/60 text-xs mb-2 block font-medium">
                  اسم المجموعة (للحفظ) <span className="text-red-400">*</span>
                </label>
                <input
                  value={certName}
                  onChange={e => setCertName(e.target.value)}
                  placeholder="مثال: TestCert_Mohammed"
                  className={inp}
                />
                <p className="text-white/20 text-xs mt-1">معرّف داخلي فريد — يُربط به المشتركون لاحقاً</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex gap-3 shrink-0">
          {step === "upload" && (
            <>
              <button
                onClick={analyze}
                disabled={!p12File || !provFile}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#f59e0b" }}
              >
                <FlaskConical className="w-4 h-4" />
                تحليل الشهادة
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                إلغاء
              </button>
            </>
          )}
          {(step === "results") && (
            <>
              <button
                onClick={save}
                disabled={saving || !certName.trim() || (!mp && !p12)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#0a0a0a] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: A }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                حفظ المجموعة
              </button>
              <button onClick={() => setStep("upload")} className="px-4 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                تحليل مجدداً
              </button>
            </>
          )}
          {step === "saving" && (
            <div className="flex-1 flex items-center justify-center py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
              <span className="text-white/40 text-sm mr-2">جاري الحفظ...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Group Form Modal ─────────────────────────────────────────────────────────
function GroupFormModal({ group, onClose, onSaved }: { group?: GroupRecord; onClose: () => void; onSaved: () => void }) {
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
      setError("يرجى تعبئة جميع الحقول المطلوبة"); return;
    }
    setSaving(true);
    const res = await adminFetch(isEdit ? `/admin/groups/${group!.id}` : "/admin/groups", {
      method: isEdit ? "PUT" : "POST",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "حدث خطأ"); return; }
    onSaved(); onClose();
  };

  const inp = "w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#9fbcff]/50 transition-colors";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h3 className="text-white font-bold text-sm">{isEdit ? "تعديل المجموعة" : "إضافة مجموعة جديدة"}</h3>
            <p className="text-white/40 text-xs mt-0.5">طاقة: {IOS_LIMIT + MAC_LIMIT} آيفون + {IPAD_LIMIT} آيباد (حد الأمان {IOS_LIMIT}/100)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">اسم الشهادة (_id) {!isEdit && <span className="text-red-400">*</span>}</label>
            <input value={form.certName} onChange={set("certName")} className={inp} placeholder="مثال: G1_Mohammed_Cert" />
            <p className="text-white/20 text-xs mt-1">معرف داخلي فريد — يُربط به جميع مشتركي هذه الشهادة</p>
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
              {isEdit && <span className="text-white/20 mr-1">— اتركه فارغاً للإبقاء على الحالي</span>}
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
            <input value={form.email} onChange={set("email")} className={inp} type="email" dir="ltr" placeholder="dev@example.com" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/8 flex gap-3">
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
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
function GroupCard({ group, onDelete, onEdit, onViewDevices, onRefresh }: {
  group: GroupRecord;
  onDelete: () => void;
  onEdit: () => void;
  onViewDevices: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingIpa, setUploadingIpa] = useState(false);
  const [localIpaPath, setLocalIpaPath] = useState<string | null>(group.storeIpaPath || null);
  const storeIpaRef = useRef<HTMLInputElement>(null);

  const ios = group.iphoneOfficialCount;
  const mac = group.iphoneMacCount;
  const ipad = group.ipadCount;
  const iphoneTotal = ios + mac;
  const bypassActive = mac > 0;
  const totalUsed = iphoneTotal + ipad;
  const totalCap = IPHONE_TOTAL + IPAD_LIMIT;

  const handleSync = async () => {
    setSyncing(true);
    await adminFetch(`/admin/groups/${group.id}/sync`, { method: "POST" });
    setSyncing(false);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm(`حذف "${group.certName}"؟`)) return;
    setDeleting(true);
    await adminFetch(`/admin/groups/${group.id}`, { method: "DELETE" });
    onDelete();
  };

  const handleUploadStoreIpa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIpa(true);
    const fd = new FormData();
    fd.append("ipa", file);
    try {
      const res = await adminUpload(`/admin/groups/${group.id}/store-ipa`, fd);
      const data = await res.json();
      if (data.success) {
        setLocalIpaPath(data.storeIpaPath);
        toast({ title: "✅ تم رفع IPA المتجر", description: "يمكنك نسخ رابط التحميل الآن" });
      } else {
        toast({ title: "خطأ", description: data.error || "فشل الرفع", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الرفع", variant: "destructive" });
    }
    setUploadingIpa(false);
    if (storeIpaRef.current) storeIpaRef.current.value = "";
  };

  const handleRemoveStoreIpa = async () => {
    if (!confirm("إزالة IPA المتجر من هذه المجموعة؟")) return;
    const res = await adminFetch(`/admin/groups/${group.id}/store-ipa`, { method: "DELETE" });
    if (res.ok) {
      setLocalIpaPath(null);
      toast({ title: "تم الحذف" });
    }
  };

  const handleCopyDownloadLink = async () => {
    try {
      const res = await adminFetch(`/admin/groups/${encodeURIComponent(group.certName)}/download-link`);
      const data = await res.json();
      if (data.downloadLink) {
        await navigator.clipboard.writeText(data.downloadLink);
        toast({ title: "✅ تم نسخ رابط التحميل", description: "itms-services link" });
      } else {
        toast({ title: "لا يوجد IPA مرفوع لهذه المجموعة", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في النسخ", variant: "destructive" });
    }
  };

  const handleCopyActivationPage = () => {
    const url = window.location.origin + "/activate";
    navigator.clipboard.writeText(url);
    toast({ title: "✅ تم نسخ رابط صفحة التفعيل" });
  };

  const syncAgo = group.lastSyncAt
    ? (() => {
      const diff = Date.now() - new Date(group.lastSyncAt).getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      return h > 0 ? `قبل ${h} ساعة` : `قبل ${m} دقيقة`;
    })()
    : "لم تتم المزامنة";

  return (
    <div className="bg-[#111111] border border-white/8 rounded-2xl overflow-hidden flex flex-col" dir="rtl">
      <div className="p-5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: group.groupType === "test_certificate" ? "#f59e0b18" : `${A}15` }}>
              {group.groupType === "test_certificate"
                ? <FlaskConical className="w-5 h-5 text-yellow-400" />
                : <Shield className="w-5 h-5" style={{ color: A }} />}
              {bypassActive && group.groupType !== "test_certificate" && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-black" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-white font-bold text-sm truncate">{group.certName}</h3>
                {group.groupType === "test_certificate" && (
                  <span className="px-1.5 py-0.5 rounded-md text-xs font-bold shrink-0"
                    style={{ background: "#f59e0b18", color: "#f59e0b" }}>تجريبية</span>
                )}
              </div>
              {group.groupType === "test_certificate"
                ? <p className="text-white/30 text-xs truncate">{group.certCommonName || group.teamName || "—"}</p>
                : group.email && <p className="text-white/30 text-xs truncate">{group.email}</p>}
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

        {group.groupType === "test_certificate" ? (
          /* ── Test Certificate Summary ── */
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              {
                l: "أجهزة البروفايل",
                v: group.provisionedUdidCount ? String(group.provisionedUdidCount) : "0",
                c: "#f59e0b",
              },
              { l: "نشط", v: String(group.activeCount ?? 0), c: "#22c55e" },
              { l: "معلق", v: String(group.pendingCount ?? 0), c: A },
            ].map(s => (
              <div key={s.l} className="bg-[#0a0a0a] rounded-xl p-2 text-center">
                <p className="font-bold text-base leading-tight" style={{ fontFamily: "Outfit, sans-serif", color: s.c }}>{s.v}</p>
                <p className="text-white/30 text-xs mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* MAC Bypass Alert */}
            {bypassActive && (
              <div className="flex items-center gap-2 bg-yellow-500/8 border border-yellow-500/15 rounded-xl px-3 py-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="text-yellow-400 text-xs font-medium">MAC Bypass نشط — {mac} جهاز إضافي ({ios + mac}/{IPHONE_TOTAL})</span>
              </div>
            )}

            {/* Slot Bars */}
            <div className="space-y-2.5 mb-4">
              <SlotBar icon={<Smartphone className="w-3.5 h-3.5" />} label="آيفون (IOS رسمي)"
                used={ios} limit={IOS_LIMIT} color="#22c55e" safetyNote="حد الأمان 98" />
              <SlotBar icon={<Monitor className="w-3.5 h-3.5" />} label="آيفون (MAC Bypass ⚡)"
                used={mac} limit={MAC_LIMIT} color="#f59e0b" />
              <SlotBar icon={<Tablet className="w-3.5 h-3.5" />} label="آيباد"
                used={ipad} limit={IPAD_LIMIT} color={A} />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { l: "آيفون", v: iphoneTotal, max: IPHONE_TOTAL, c: ios >= IOS_LIMIT ? "#f59e0b" : "#22c55e" },
                { l: "آيباد", v: ipad, max: IPAD_LIMIT, c: A },
                { l: "نشط", v: group.activeCount, c: "#22c55e" },
                { l: "معلق", v: group.pendingCount, c: "#f59e0b" },
              ].map(s => (
                <div key={s.l} className="bg-[#0a0a0a] rounded-xl p-2 text-center">
                  <p className="font-bold text-base leading-tight" style={{ fontFamily: "Outfit, sans-serif", color: s.c }}>{s.v}</p>
                  {"max" in s && <p className="text-white/15 text-xs font-mono">{s.v}/{s.max}</p>}
                  <p className="text-white/30 text-xs mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            {/* Stacked bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/30">الاستخدام الإجمالي</span>
                <span className="text-white/50 font-mono">{totalUsed}/{totalCap}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                <div className="h-full bg-green-500/70 transition-all duration-700"
                  style={{ width: `${(ios / totalCap) * 100}%` }} />
                <div className="h-full bg-yellow-400/70 transition-all duration-700"
                  style={{ width: `${(mac / totalCap) * 100}%` }} />
                <div className="h-full transition-all duration-700"
                  style={{ width: `${(ipad / totalCap) * 100}%`, background: `${A}80` }} />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-white/20 text-xs"><span className="w-2 h-1.5 rounded-sm bg-green-500/70" />IOS</span>
                <span className="flex items-center gap-1 text-white/20 text-xs"><span className="w-2 h-1.5 rounded-sm bg-yellow-400/70" />MAC⚡</span>
                <span className="flex items-center gap-1 text-white/20 text-xs"><span className="w-2 h-1.5 rounded-sm" style={{ background: `${A}80` }} />iPad</span>
              </div>
            </div>

            {/* Last Sync */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#0a0a0a] rounded-xl mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-white/25" />
                <div>
                  <p className="text-white/40 text-xs">آخر مزامنة</p>
                  <p className="text-white/60 text-xs font-medium">{syncAgo}</p>
                </div>
              </div>
              <button onClick={handleSync} disabled={syncing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
                style={{ background: `${A}15`, color: A }}>
                {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {syncing ? "جاري..." : "تحديث"}
              </button>
            </div>
          </>
        )}

        {/* Store IPA Section */}
        <div className="mb-3 p-3 rounded-xl border"
          style={{ background: localIpaPath ? "#22c55e08" : "#9fbcff08", borderColor: localIpaPath ? "#22c55e20" : "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5" style={{ color: localIpaPath ? "#22c55e" : A }} />
              <span className="text-xs font-semibold" style={{ color: localIpaPath ? "#22c55e" : "rgba(255,255,255,0.5)" }}>
                {localIpaPath ? "IPA المتجر محمّل" : "IPA المتجر (رابط التحميل)"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {localIpaPath && (
                <>
                  <button
                    onClick={handleCopyDownloadLink}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ background: `${A}15`, color: A }}
                    title="نسخ رابط itms-services"
                  >
                    <Copy className="w-3 h-3" />نسخ الرابط
                  </button>
                  <button
                    onClick={handleCopyActivationPage}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                    title="نسخ رابط صفحة التفعيل"
                  >
                    <Globe className="w-3 h-3" />رابط التفعيل
                  </button>
                  <button
                    onClick={handleRemoveStoreIpa}
                    className="p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="حذف IPA"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                onClick={() => storeIpaRef.current?.click()}
                disabled={uploadingIpa}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-40"
                style={localIpaPath
                  ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }
                  : { background: `${A}20`, color: A }}
              >
                {uploadingIpa
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Upload className="w-3 h-3" />}
                {uploadingIpa ? "جاري الرفع..." : localIpaPath ? "تغيير" : "رفع IPA"}
              </button>
              <input
                ref={storeIpaRef}
                type="file"
                accept=".ipa"
                className="hidden"
                onChange={handleUploadStoreIpa}
              />
            </div>
          </div>
          {localIpaPath && (
            <p className="text-white/20 text-xs font-mono truncate">
              {localIpaPath.split("/").pop()}
            </p>
          )}
          {!localIpaPath && (
            <p className="text-white/20 text-xs">
              ارفع IPA المتجر الموقّع لتفعيل رابط التحميل للمشتركين
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onViewDevices}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
            style={{ background: `${A}15`, color: A }}>
            <Smartphone className="w-3.5 h-3.5" />خريطة الأجهزة
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            التفاصيل
          </button>
        </div>
      </div>

      {/* Expanded Technical Details */}
      {expanded && (
        <div className="border-t border-white/5 px-5 py-4 bg-[#0d0d0d]">
          {group.groupType === "test_certificate" ? (
            <>
              <h4 className="text-white/40 text-xs font-semibold mb-3 flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5 text-yellow-400" />تفاصيل الشهادة التجريبية
              </h4>
              {[
                { l: "الاسم (CN)", v: group.certCommonName || "—", mono: true },
                { l: "Team ID", v: group.teamId || "—", mono: true },
                { l: "Team Name", v: group.teamName || "—" },
                { l: "Bundle ID", v: group.bundleId || "—", mono: true },
                { l: "البروفايل", v: group.provisionName || "—" },
                {
                  l: "تاريخ الانتهاء",
                  v: group.certExpiresAt
                    ? new Date(group.certExpiresAt).toLocaleDateString("ar-SA") +
                      (new Date(group.certExpiresAt) < new Date() ? " ⚠️ منتهية" : "")
                    : "—"
                },
                { l: "أجهزة البروفايل", v: group.provisionedUdidCount ? `${group.provisionedUdidCount} جهاز` : "—" },
                { l: "تاريخ الإضافة", v: new Date(group.createdAt).toLocaleDateString("ar-SA") },
              ].map(r => (
                <div key={r.l} className="flex items-start justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-white/25 text-xs shrink-0">{r.l}</span>
                  <span className={`text-white/55 text-xs text-left break-all ${r.mono ? "font-mono" : ""}`}>{r.v}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <h4 className="text-white/40 text-xs font-semibold mb-3 flex items-center gap-2">
                <Key className="w-3.5 h-3.5" />معلومات تقنية
              </h4>
              {[
                { l: "Issuer ID", v: group.issuerId, mono: true },
                { l: "Key ID", v: group.keyId, mono: true },
                { l: "Private Key", v: "••••••••••••••", mono: true },
                { l: "البريد", v: group.email || "—" },
                { l: "تاريخ الإضافة", v: new Date(group.createdAt).toLocaleDateString("ar-SA") },
                ...(group.lastSyncNote ? [{ l: "ملاحظة المزامنة", v: group.lastSyncNote }] : []),
              ].map(r => (
                <div key={r.l} className="flex items-start justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-white/25 text-xs shrink-0">{r.l}</span>
                  <span className={`text-white/55 text-xs text-left break-all ${r.mono ? "font-mono" : ""}`}>{r.v}</span>
                </div>
              ))}
              <div className="mt-4 pt-3 border-t border-white/5">
                <h4 className="text-white/40 text-xs font-semibold mb-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" />متى يتصل السيرفر بأبل؟
                </h4>
                <div className="space-y-1.5 text-xs text-white/25 leading-relaxed">
                  {[
                    ["✅", "عند تسجيل مشترك جديد (Registration)"],
                    ["🔘", "عند ضغط زر التحديث اليدوي فقط"],
                    ["📄", "عند طلب توقيع التطبيق (Signing)"],
                    ["⏰", "Cron Job يومي الساعة 4 فجراً (Audit)"],
                    ["🚫", "لا يتصل تلقائياً عند فتح الصفحة"],
                  ].map(([icon, text]) => (
                    <div key={text} className="flex items-start gap-2">
                      <span>{icon}</span><span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
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
  const [showTestAdd, setShowTestAdd] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupRecord | null>(null);
  const [devicesGroup, setDevicesGroup] = useState<GroupRecord | null>(null);
  const [showCode, setShowCode] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    const res = await adminFetch("/admin/groups");
    const d = await res.json();
    setGroups(d?.groups || []);
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const totalIPhone = groups.reduce((s, g) => s + (g.iphoneOfficialCount || 0) + (g.iphoneMacCount || 0), 0);
  const totalIPad = groups.reduce((s, g) => s + (g.ipadCount || 0), 0);
  const totalPending = groups.reduce((s, g) => s + (g.pendingCount || 0), 0);
  // شهادات فعالة = فيها مشتركين
  const activeCerts = groups.filter(g => g.totalDevices > 0).length;
  // شهادات مغلقة = وصلت حد الآيفون (IOS + MAC) أو الآيباد
  const fullCerts = groups.filter(g =>
    (g.iphoneOfficialCount + g.iphoneMacCount) >= IPHONE_TOTAL || g.ipadCount >= IPAD_LIMIT
  ).length;

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">المجموعات</h2>
            <p className="text-white/40 text-xs mt-0.5">
              شهادات Apple Developer · {IOS_LIMIT + MAC_LIMIT} آيفون + {IPAD_LIMIT} آيباد · حد أمان 98
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCode(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-colors"
              style={{ background: `${A}10`, color: A }}>
              <Code2 className="w-3.5 h-3.5" />كود Apple API
            </button>
            <button onClick={fetchGroups} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowTestAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 border"
              style={{ background: "#f59e0b18", color: "#f59e0b", borderColor: "#f59e0b30" }}>
              <FlaskConical className="w-4 h-4" />إضافة مجموعة تجريبية
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#0a0a0a] hover:opacity-90"
              style={{ background: A }}>
              <Plus className="w-4 h-4" />إضافة مجموعة
            </button>
          </div>
        </div>

        {/* Stats */}
        {groups.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              {
                l: "الشهادات",
                v: groups.length,
                sub: "المجموع",
                c: A,
                icon: <Shield className="w-3.5 h-3.5" />,
              },
              {
                l: "شهادات فعالة",
                v: activeCerts,
                sub: "فيها مشتركين",
                c: "#22c55e",
                icon: <CheckCircle className="w-3.5 h-3.5" />,
              },
              {
                l: "شهادات مغلقة",
                v: fullCerts,
                sub: "وصلت الحد",
                c: fullCerts > 0 ? "#ef4444" : "#475569",
                icon: <AlertTriangle className="w-3.5 h-3.5" />,
              },
              {
                l: "مشتركين آيفون",
                v: totalIPhone,
                sub: `من ${groups.length * IPHONE_TOTAL} مقعد`,
                c: "#22c55e",
                icon: <Smartphone className="w-3.5 h-3.5" />,
              },
              {
                l: "مشتركين آيباد",
                v: totalIPad,
                sub: `من ${groups.length * IPAD_LIMIT} مقعد`,
                c: A,
                icon: <Tablet className="w-3.5 h-3.5" />,
              },
              {
                l: "انتظار تفعيل",
                v: totalPending,
                sub: "في كل الشهادات",
                c: totalPending > 0 ? "#f59e0b" : "#475569",
                icon: <Clock className="w-3.5 h-3.5" />,
              },
            ].map(s => (
              <div key={s.l} className="bg-[#111111] border border-white/8 rounded-xl p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 mb-0.5" style={{ color: s.c }}>
                  {s.icon}
                  <span className="text-xs font-medium opacity-80">{s.l}</span>
                </div>
                <p className="text-2xl font-black leading-tight" style={{ fontFamily: "Outfit, sans-serif", color: s.c }}>
                  {s.v}
                </p>
                <p className="text-white/25 text-xs">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Safety Info */}
        <div className="flex items-start gap-3 bg-[#111111] border border-white/5 rounded-xl px-4 py-3">
          <Shield className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
          <div className="text-xs text-white/30 leading-relaxed">
            <strong className="text-white/50">نظام التسجيل الذكي</strong> —
            الحد الفعلي <code className="bg-white/5 px-1 rounded">98</code> بدل 100 (مقعدان للطوارئ) ·
            فحص UDID مكرر تلقائياً ·
            قراءة من DB المحلية (سريعة) ·
            اتصال بأبل عند الحاجة فقط
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center bg-[#111111] rounded-2xl border border-white/8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${A}15` }}>
              <Shield className="w-7 h-7" style={{ color: A }} />
            </div>
            <p className="text-white/50 text-sm font-medium mb-1">لا توجد مجموعات</p>
            <p className="text-white/25 text-xs mb-1">كل شهادة: {IOS_LIMIT} آيفون IOS + {MAC_LIMIT} آيفون MAC⚡ + {IPAD_LIMIT} آيباد</p>
            <p className="text-white/15 text-xs mb-5">التحويل IOS → MAC تلقائي عند امتلاء الخانة الأولى</p>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0a0a0a]"
              style={{ background: A }}>
              <Plus className="w-4 h-4" />إضافة مجموعة
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
                onRefresh={fetchGroups}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && <GroupFormModal onClose={() => setShowAdd(false)} onSaved={fetchGroups} />}
      {showTestAdd && <TestGroupModal onClose={() => setShowTestAdd(false)} onSaved={fetchGroups} />}
      {editGroup && <GroupFormModal group={editGroup} onClose={() => setEditGroup(null)} onSaved={fetchGroups} />}
      {devicesGroup && <DevicesModal group={devicesGroup} onClose={() => setDevicesGroup(null)} />}
      {showCode && <CodeModal onClose={() => setShowCode(false)} />}
    </AdminLayout>
  );
}
