import { useState } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, ArrowLeft,
  Download, Smartphone, Tablet, Monitor, Send,
  Key, User, Phone, Mail, Copy, ExternalLink, Package, Shield
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const BASE = import.meta.env.BASE_URL || "/";
const A = "#9fbcff";

type Step = "code" | "download" | "form" | "submitting" | "success" | "error";

interface ValidateResult {
  valid: boolean;
  alreadyRegistered?: boolean;
  subscriptionId?: number;
  subscriberId?: number;
  code: string;
  planName: string | null;
  groupName: string | null;
  downloadLink: string | null;
  hasIpa: boolean;
}

interface SuccessData {
  subscriber: {
    id: number;
    code: string;
    subscriberName: string | null;
    phone: string | null;
    email: string | null;
    udid: string | null;
    deviceType: string | null;
    groupName: string | null;
    isActive: string;
    activatedAt: string | null;
    expiresAt: string | null;
    planName: string | null;
  };
  storeDownloadLink: string | null;
}

const inp =
  "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors";

function Logo() {
  return (
    <div className="text-center mb-8">
      <img
        src={`${BASE}mismari-logo-final.png`}
        alt="Mismari"
        className="h-16 w-auto object-contain mx-auto mb-3"
      />
      <p className="text-white/40 text-sm">تفعيل الاشتراك</p>
    </div>
  );
}

function DeviceTypeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = [
    { v: "iPhone", label: "iPhone", Icon: Smartphone },
    { v: "iPad", label: "iPad", Icon: Tablet },
    { v: "Mac", label: "Mac", Icon: Monitor },
  ];
  return (
    <div className="flex gap-2">
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all text-xs font-medium"
          style={
            value === v
              ? { background: `${A}20`, color: A, borderColor: `${A}40` }
              : { background: "transparent", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.08)" }
          }
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Activate() {
  const [step, setStep] = useState<Step>("code");
  const [errorMsg, setErrorMsg] = useState("");

  // Step 1: code input
  const [codeInput, setCodeInput] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [validated, setValidated] = useState<ValidateResult | null>(null);

  // Step 3: registration form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [udid, setUdid] = useState("");
  const [deviceType, setDeviceType] = useState("iPhone");

  // Step 4: success
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setCodeLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API}/api/activate/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErrorMsg(data.error || "كود الاشتراك غير صحيح");
        setCodeLoading(false);
        return;
      }
      setValidated(data);
      if (data.alreadyRegistered) {
        setStep("success");
        // Map to success format
        setSuccessData({
          subscriber: {
            id: data.subscriberId || 0,
            code: data.code,
            subscriberName: null,
            phone: null,
            email: null,
            udid: null,
            deviceType: null,
            groupName: data.groupName,
            isActive: "true",
            activatedAt: null,
            expiresAt: null,
            planName: data.planName,
          },
          storeDownloadLink: data.downloadLink,
        });
      } else {
        setStep("download");
      }
    } catch {
      setErrorMsg("حدث خطأ، يرجى المحاولة مرة أخرى");
    }
    setCodeLoading(false);
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg("الاسم مطلوب"); return; }
    if (!phone.trim()) { setErrorMsg("رقم الهاتف مطلوب"); return; }
    setErrorMsg("");
    setStep("submitting");
    try {
      const res = await fetch(`${API}/api/activate/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: validated?.subscriptionId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          udid: udid.trim() || undefined,
          deviceType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "حدث خطأ");
        setStep("form");
        return;
      }
      setSuccessData(data);
      setStep("success");
    } catch {
      setErrorMsg("حدث خطأ أثناء الحفظ");
      setStep("form");
    }
  };

  const copyProfileLink = () => {
    const link = window.location.origin + BASE + "activate";
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <Logo />

        {/* ─── Step 1: Enter Code ─── */}
        {step === "code" && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${A}20` }}>
                  <Key className="w-4 h-4" style={{ color: A }} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">أدخل كود الاشتراك</h2>
                  <p className="text-white/40 text-xs mt-0.5">الكود المرسل إليك من الإدارة</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleValidateCode} className="p-5 space-y-4">
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                placeholder="XXXXXXXXXX"
                dir="ltr"
                className={inp + " text-center text-lg font-mono tracking-widest"}
                autoCapitalize="characters"
              />
              {errorMsg && (
                <div className="flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={codeLoading || !codeInput.trim()}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                style={{ background: A, color: "#000" }}
              >
                {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {codeLoading ? "جارٍ التحقق..." : "تحقق من الكود"}
              </button>
            </form>
          </div>
        )}

        {/* ─── Step 2: Download + Form ─── */}
        {(step === "download" || step === "form" || step === "submitting") && validated && (
          <div className="space-y-4">
            {/* Code info */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#34C75920" }}>
                  <CheckCircle2 className="w-4.5 h-4.5 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{validated.code}</p>
                  <p className="text-white/40 text-xs">{validated.planName || "اشتراك فعّال"}</p>
                </div>
              </div>
              {validated.groupName && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ background: `${A}15`, color: A }}>
                  <Shield className="w-3 h-3" />
                  <span className="font-mono">{validated.groupName}</span>
                </div>
              )}
            </div>

            {/* Download section */}
            {validated.hasIpa && validated.downloadLink && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/15">
                      <Download className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm">تحميل تطبيق مسماري+</h3>
                      <p className="text-white/40 text-xs">اضغط لتثبيت التطبيق الخاص بشهادتك</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <a
                    href={validated.downloadLink}
                    className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    تحميل مسماري+
                  </a>
                  <p className="text-white/25 text-xs text-center mt-3">
                    بعد تثبيت التطبيق، أكمل تسجيل بياناتك أدناه
                  </p>
                </div>
              </div>
            )}

            {/* Registration form */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${A}20` }}>
                    <User className="w-4 h-4" style={{ color: A }} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">أكمل تسجيل بياناتك</h3>
                    <p className="text-white/40 text-xs">ستُحفظ بياناتك مع كود الاشتراك</p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleCompleteRegistration} className="p-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" style={{ color: A }} /> الاسم الكامل *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    className={inp}
                    style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif" }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" style={{ color: A }} /> رقم الهاتف *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    className={inp + " text-left font-mono"}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" style={{ color: A }} /> البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    dir="ltr"
                    className={inp + " text-left"}
                  />
                </div>

                {/* UDID (optional) */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    UDID الجهاز <span className="text-white/25">(اختياري)</span>
                  </label>
                  <input
                    type="text"
                    value={udid}
                    onChange={e => setUdid(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    dir="ltr"
                    className={inp + " text-left font-mono text-xs"}
                  />
                </div>

                {/* Device type */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">نوع الجهاز</label>
                  <DeviceTypeSelector value={deviceType} onChange={setDeviceType} />
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={step === "submitting"}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: A, color: "#000" }}
                >
                  {step === "submitting"
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                  {step === "submitting" ? "جارٍ الحفظ..." : "تأكيد التسجيل"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── Step 5: Success ─── */}
        {step === "success" && successData && (
          <div className="space-y-4">
            {/* Success header */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "#34C75920", border: "1px solid #34C75940" }}
              >
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-xl mb-1">
                {validated?.alreadyRegistered ? "أنت مشترك بالفعل!" : "تم التسجيل بنجاح!"}
              </h2>
              <p className="text-white/40 text-sm">مرحباً {successData.subscriber.subscriberName || "بك"}</p>
            </div>

            {/* Subscription details */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: A }} />
                <h3 className="text-sm font-bold text-white">تفاصيل الاشتراك</h3>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { label: "كود الاشتراك", value: successData.subscriber.code, mono: true },
                  { label: "الباقة", value: successData.subscriber.planName, mono: false },
                  { label: "المجموعة", value: successData.subscriber.groupName, mono: true },
                  { label: "نوع الجهاز", value: successData.subscriber.deviceType, mono: false },
                  {
                    label: "الحالة",
                    value: successData.subscriber.isActive === "true" ? "✅ نشط" : "❌ غير نشط",
                    mono: false,
                  },
                  {
                    label: "ينتهي في",
                    value: successData.subscriber.expiresAt
                      ? new Date(successData.subscriber.expiresAt).toLocaleDateString("ar-SA")
                      : "غير محدد",
                    mono: false,
                  },
                ].map(row => (
                  <div key={row.label} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-white/40 text-xs">{row.label}</span>
                    <span className={`text-white text-sm ${row.mono ? "font-mono text-xs" : ""}`}>
                      {row.value || <span className="text-white/20">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscriber profile link */}
            {successData.subscriber.id > 0 && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4">
                <p className="text-white/50 text-xs mb-3">رابط ملف اشتراكك الشخصي</p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs truncate"
                    style={{ color: A }}
                  >
                    {window.location.origin}{BASE}subscriber/{successData.subscriber.id}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}${BASE}subscriber/${successData.subscriber.id}`
                      );
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="p-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all shrink-0"
                  >
                    {copiedLink ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`${BASE}subscriber/${successData.subscriber.id}`}
                    className="p-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Store download link */}
            {successData.storeDownloadLink && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-white">تحميل متجر مسماري+</h3>
                </div>
                <div className="p-5">
                  <a
                    href={successData.storeDownloadLink}
                    className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    تحميل التطبيق
                  </a>
                  <p className="text-white/25 text-xs text-center mt-2">
                    اضغط لتثبيت نسخة مسماري+ الخاصة بشهادتك
                  </p>
                </div>
              </div>
            )}

            {/* Plan info */}
            {successData.subscriber.planName && (
              <div
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: `${A}10`, border: `1px solid ${A}20` }}
              >
                <Package className="w-5 h-5 shrink-0" style={{ color: A }} />
                <div>
                  <p className="text-xs text-white/40 mb-0.5">باقتك الحالية</p>
                  <p className="text-white font-bold text-sm">{successData.subscriber.planName}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Error state ─── */}
        {step === "error" && (
          <div className="bg-[#0a0a0a] border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h2 className="text-white font-bold text-xl mb-2">حدث خطأ</h2>
              <p className="text-white/50 text-sm">{errorMsg}</p>
            </div>
            <button
              onClick={() => { setStep("code"); setErrorMsg(""); }}
              className="flex items-center gap-2 mx-auto text-sm text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              العودة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
