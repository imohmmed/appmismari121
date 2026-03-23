import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, ArrowLeft,
  Download, Smartphone, Tablet, Send,
  Key, User, Phone, Mail, Copy, ExternalLink, Shield, CheckCircle,
  CreditCard, Calendar, Cpu, Users, Activity,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const BASE = import.meta.env.BASE_URL || "/";
const A = "#9fbcff";

type Step = "code" | "waiting-udid" | "form" | "submitting" | "success" | "error";

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
    balance: number;
    activatedAt: string | null;
    expiresAt: string | null;
    createdAt: string | null;
    planName: string | null;
    planNameAr: string | null;
  };
  storeDownloadLink: string | null;
  appleMessage?: string;
}

const inp = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors";

function getOrCreateToken(): string {
  const saved = sessionStorage.getItem("activate_token");
  if (saved) return saved;
  const t = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
  sessionStorage.setItem("activate_token", t);
  return t;
}

export default function Activate() {
  const [step, setStep] = useState<Step>("code");
  const [errorMsg, setErrorMsg] = useState("");
  const [token] = useState(() => getOrCreateToken());

  const [codeInput, setCodeInput] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [validated, setValidated] = useState<ValidateResult | null>(null);

  const [udid, setUdid] = useState("");
  const [udidFound, setUdidFound] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deviceType, setDeviceType] = useState("iPhone");

  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foundRef = useRef(false);
  const autoTriggeredRef = useRef(false);

  const profileUrl = `${API}/api/profile/enroll?source=activate&token=${encodeURIComponent(token)}`;

  const pollOnce = useCallback(async () => {
    if (foundRef.current) return;
    try {
      const r = await fetch(`${API}/api/profile/udid-check?token=${token}`, { cache: "no-store" });
      const d = await r.json();
      if (d.found && d.udid) {
        foundRef.current = true;
        clearInterval(pollingRef.current!);
        setUdid(d.udid);
        setUdidFound(true);
        sessionStorage.setItem("activate_udid", d.udid);
        setStep("form");
      }
    } catch {}
  }, [token]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    foundRef.current = false;
    pollingRef.current = setInterval(pollOnce, 2000);
    pollOnce();
  }, [pollOnce]);

  useEffect(() => {
    const savedUdid = sessionStorage.getItem("activate_udid");
    if (savedUdid && step === "code") {
      setUdid(savedUdid);
      setUdidFound(true);
      foundRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (step !== "waiting-udid") return;

    if (!autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      const a = document.createElement("a");
      a.href = profileUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    startPolling();

    const onVisible = () => { if (!document.hidden) pollOnce(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step]);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const doValidateCode = async (code: string) => {
    if (!code.trim()) return;
    setCodeLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API}/api/activate/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErrorMsg(data.error || "كود الاشتراك غير صحيح");
        setCodeLoading(false);
        return;
      }
      setValidated(data);
      if (data.alreadyRegistered) {
        // Already registered — fetch full subscriber details to display
        try {
          const subRes = await fetch(`${API}/api/subscriber/${encodeURIComponent(data.code)}`);
          const subData = subRes.ok ? await subRes.json() : null;
          const s = subData?.subscriber;
          setSuccessData({
            subscriber: {
              id: s?.id || data.subscriberId || 0,
              code: data.code,
              subscriberName: s?.subscriberName || null,
              phone: s?.phone || null,
              email: s?.email || null,
              udid: s?.udid || null,
              deviceType: s?.deviceType || null,
              groupName: s?.groupName || data.groupName,
              isActive: s?.isActive ?? "true",
              balance: s?.balance ?? 0,
              activatedAt: s?.activatedAt || null,
              expiresAt: s?.expiresAt || null,
              createdAt: s?.createdAt || null,
              planName: s?.planName || data.planName,
              planNameAr: s?.planNameAr || null,
            },
            storeDownloadLink: s?.storeDownloadLink || data.downloadLink,
          });
        } catch {
          setSuccessData({
            subscriber: {
              id: data.subscriberId || 0, code: data.code, subscriberName: null, phone: null,
              email: null, udid: null, deviceType: null, groupName: data.groupName,
              isActive: "true", balance: 0, activatedAt: null, expiresAt: null,
              createdAt: null, planName: data.planName, planNameAr: null,
            },
            storeDownloadLink: data.downloadLink,
          });
        }
        setStep("success");
      } else {
        const savedUdid = sessionStorage.getItem("activate_udid");
        if (savedUdid) {
          setUdid(savedUdid);
          setUdidFound(true);
          foundRef.current = true;
          setStep("form");
        } else {
          setStep("waiting-udid");
        }
      }
    } catch {
      setErrorMsg("حدث خطأ، يرجى المحاولة مرة أخرى");
    }
    setCodeLoading(false);
  };


  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    doValidateCode(codeInput);
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
      sessionStorage.removeItem("activate_token");
      sessionStorage.removeItem("activate_udid");
      setSuccessData(data);
      setStep("success");
    } catch {
      setErrorMsg("حدث خطأ أثناء الحفظ");
      setStep("form");
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src={`${BASE}mismari-logo.png`} alt="Mismari"
            className="h-10 w-auto object-contain mx-auto mb-1" />
          <p className="text-white/30 text-sm">تفعيل الاشتراك</p>
        </div>

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
              <input type="text" value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                placeholder="XXXXXXXXXX" dir="ltr"
                className={inp + " text-center text-lg font-mono tracking-widest"}
                autoCapitalize="characters" />
              {errorMsg && (
                <div className="flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <button type="submit" disabled={codeLoading || !codeInput.trim()}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: A, color: "#000" }}>
                {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {codeLoading ? "جارٍ التحقق..." : "تحقق من الكود"}
              </button>
            </form>
          </div>
        )}

        {/* ─── Step 2: Waiting for UDID ─── */}
        {step === "waiting-udid" && (
          <div className="space-y-3">
            {validated && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#34C75920" }}>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{validated.code}</p>
                    <p className="text-white/40 text-xs">{validated.planName || "اشتراك فعّال"}</p>
                  </div>
                </div>
                {validated.groupName && (
                  <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ background: `${A}15`, color: A }}>
                    <Shield className="w-3 h-3" />
                    <span className="font-mono text-xs">{validated.groupName}</span>
                  </div>
                )}
              </div>
            )}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-8 text-center space-y-5">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                  <div className="absolute inset-0 rounded-full border-t-2 animate-spin" style={{ borderColor: A }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Shield className="w-6 h-6" style={{ color: A }} />
                  </div>
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">في انتظار التثبيت</h2>
                  <p className="text-white/40 text-sm mt-1 leading-relaxed">
                    ثبّت ملف التعريف من الإعدادات، وارجع هنا بعد الانتهاء
                  </p>
                </div>
                <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4 text-right">
                  <p className="text-yellow-400/70 text-xs leading-relaxed">
                    قد تظهر رسالة خطأ من iOS — اضغط <strong className="text-yellow-400">OK</strong> وارجع لهذه الصفحة وستتحدث تلقائياً
                  </p>
                </div>
                <p className="text-white/20 text-xs">سيظهر الفورم تلقائياً بعد التثبيت</p>
              </div>
            </div>
            <button onClick={() => setStep("form")}
              className="text-xs text-white/20 hover:text-white/40 text-center w-full transition-colors">
              تخطي وإدخال البيانات يدوياً
            </button>
          </div>
        )}

        {/* ─── Step 3: Form ─── */}
        {(step === "form" || step === "submitting") && validated && (
          <div className="space-y-3">
            {/* Code badge */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#34C75920" }}>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm font-mono">{validated.code}</p>
                  <p className="text-white/40 text-xs">{validated.planName || "اشتراك فعّال"}</p>
                </div>
              </div>
            </div>

            {/* UDID status */}
            {udidFound && udid ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-green-400/90 text-xs font-medium">تم التعرف على جهازك ✓</p>
                  <p className="font-mono text-xs text-white/30 mt-0.5 truncate">{udid}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02]">
                <Shield className="w-4 h-4 text-white/20 shrink-0" />
                <p className="text-white/30 text-xs">لم يتم التعرف على الجهاز — يمكنك إكمال البيانات بدونه</p>
              </div>
            )}

            {/* IPA download if available */}
            {validated.hasIpa && validated.downloadLink && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4">
                <a href={validated.downloadLink}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-all">
                  <Download className="w-4 h-4" />
                  تحميل تطبيق مسماري+
                </a>
              </div>
            )}

            {/* Form */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/5">
                <h3 className="text-white font-bold text-sm">بيانات الاشتراك</h3>
              </div>
              <form onSubmit={handleCompleteRegistration} className="p-5 space-y-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" style={{ color: A }} /> الاسم الكامل *
                  </label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="أدخل اسمك الكامل" className={inp}
                    style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", direction: "rtl" }} />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" style={{ color: A }} /> رقم الهاتف *
                  </label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX" dir="ltr" className={inp + " text-left font-mono"} />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" style={{ color: A }} /> البريد الإلكتروني
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com" dir="ltr" className={inp + " text-left"} />
                </div>

                <div>
                  <label className="block text-xs text-white/40 mb-2">نوع الجهاز</label>
                  <div className="flex gap-2">
                    {[
                      { v: "iPhone", Icon: Smartphone },
                      { v: "iPad", Icon: Tablet },
                    ].map(({ v, Icon }) => (
                      <button key={v} type="button" onClick={() => setDeviceType(v)}
                        className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all text-xs font-medium"
                        style={deviceType === v
                          ? { background: `${A}20`, color: A, borderColor: `${A}40` }
                          : { background: "transparent", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.08)" }
                        }>
                        <Icon className="w-4 h-4" />
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button type="submit" disabled={step === "submitting"}
                  className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: A, color: "#000" }}>
                  {step === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {step === "submitting" ? "جارٍ الحفظ..." : "تأكيد التسجيل"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── Success ─── */}
        {step === "success" && successData && (
          <div className="space-y-3">

            {/* Header */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "#34C75920", border: "1px solid #34C75940" }}>
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-xl mb-1">
                {validated?.alreadyRegistered ? "أنت مشترك بالفعل!" : "تم التسجيل بنجاح!"}
              </h2>
              <p className="text-white/40 text-sm">مرحباً، {successData.subscriber.subscriberName || "بك"}</p>
              {successData.appleMessage && (
                <p className="text-xs mt-2 px-3 py-1.5 rounded-lg inline-block"
                  style={{ background: `${A}15`, color: A }}>
                  {successData.appleMessage}
                </p>
              )}
            </div>

            {/* Download Button — prominent if available */}
            {successData.storeDownloadLink && (
              <a href={successData.storeDownloadLink}
                className="flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-bold transition-all"
                style={{ background: `${A}20`, color: A, border: `1px solid ${A}40` }}>
                <Download className="w-5 h-5" />
                تحميل تطبيق مسماري+
              </a>
            )}

            {/* Personal Info */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <User className="w-3.5 h-3.5" style={{ color: A }} />
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">المعلومات الشخصية</h3>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { icon: User, label: "الاسم", value: successData.subscriber.subscriberName },
                  { icon: Phone, label: "الهاتف", value: successData.subscriber.phone, mono: true },
                  { icon: Mail, label: "البريد الإلكتروني", value: successData.subscriber.email, mono: true },
                ].map(({ icon: Icon, label, value, mono }) => (
                  <div key={label} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <Icon className="w-3.5 h-3.5 text-white/20" />
                      <span className="text-white/40 text-xs">{label}</span>
                    </div>
                    <span className={`text-white text-sm truncate ${mono ? "font-mono text-xs" : ""}`} dir={mono ? "ltr" : "rtl"}>
                      {value || <span className="text-white/20">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription Info */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" style={{ color: A }} />
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">تفاصيل الاشتراك</h3>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { icon: Key, label: "كود الاشتراك", value: successData.subscriber.code, mono: true, copyable: true },
                  { icon: Shield, label: "الباقة", value: successData.subscriber.planNameAr || successData.subscriber.planName },
                  { icon: Users, label: "المجموعة", value: successData.subscriber.groupName, mono: true },
                  { icon: Activity, label: "الحالة", value: successData.subscriber.isActive === "true" ? "نشط ✓" : "غير نشط", color: successData.subscriber.isActive === "true" ? "#22c55e" : "#ef4444" },
                  { icon: CreditCard, label: "الرصيد", value: successData.subscriber.balance !== undefined ? `${successData.subscriber.balance.toLocaleString("en-US")} د.ع` : "—" },
                ].map(({ icon: Icon, label, value, mono, copyable, color }) => (
                  <div key={label} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <Icon className="w-3.5 h-3.5 text-white/20" />
                      <span className="text-white/40 text-xs">{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm truncate ${mono ? "font-mono text-xs" : ""}`}
                        style={{ color: color || "white" }} dir={mono ? "ltr" : "rtl"}>
                        {value || <span className="text-white/20">—</span>}
                      </span>
                      {copyable && value && (
                        <button onClick={() => navigator.clipboard.writeText(value as string)}
                          className="p-1 rounded text-white/20 hover:text-white/60 transition-colors">
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device & Dates */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" style={{ color: A }} />
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">الجهاز والتواريخ</h3>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  {
                    icon: successData.subscriber.deviceType === "iPad" ? Tablet : Smartphone,
                    label: "نوع الجهاز",
                    value: successData.subscriber.deviceType,
                  },
                  {
                    icon: Cpu,
                    label: "UDID الجهاز",
                    value: successData.subscriber.udid,
                    mono: true,
                  },
                  {
                    icon: Calendar,
                    label: "تاريخ التسجيل",
                    value: successData.subscriber.createdAt
                      ? new Date(successData.subscriber.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : null,
                  },
                  {
                    icon: Calendar,
                    label: "تاريخ التفعيل",
                    value: successData.subscriber.activatedAt
                      ? new Date(successData.subscriber.activatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : null,
                  },
                  {
                    icon: Calendar,
                    label: "ينتهي في",
                    value: successData.subscriber.expiresAt
                      ? new Date(successData.subscriber.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : "غير محدد",
                    color: successData.subscriber.expiresAt
                      ? (new Date(successData.subscriber.expiresAt) < new Date() ? "#ef4444" : "#22c55e")
                      : undefined,
                  },
                ].map(({ icon: Icon, label, value, mono, color }) => (
                  <div key={label} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <Icon className="w-3.5 h-3.5 text-white/20" />
                      <span className="text-white/40 text-xs">{label}</span>
                    </div>
                    <span className={`text-sm ${mono ? "font-mono text-[10px]" : ""}`}
                      style={{ color: color || "white" }} dir="ltr">
                      {value || <span className="text-white/20">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Link */}
            {successData.subscriber.id > 0 && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4">
                <p className="text-white/30 text-xs mb-2.5 flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  رابط ملف اشتراكك
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs truncate" style={{ color: A }} dir="ltr">
                    {window.location.origin}{BASE}subscriber/{successData.subscriber.code || successData.subscriber.id}
                  </div>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${BASE}subscriber/${successData.subscriber.code || successData.subscriber.id}`);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                    className="p-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-all shrink-0">
                    {copiedLink ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ─── Error ─── */}
        {step === "error" && (
          <div className="bg-[#0a0a0a] border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h2 className="text-white font-bold text-xl mb-2">حدث خطأ</h2>
              <p className="text-white/50 text-sm">{errorMsg}</p>
            </div>
            <button onClick={() => { setStep("code"); setErrorMsg(""); }}
              className="flex items-center gap-2 mx-auto text-sm text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              العودة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
