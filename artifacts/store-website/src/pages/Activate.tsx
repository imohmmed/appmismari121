import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, CheckCircle2, AlertCircle,
  Download, Send, Smartphone,
  Key, User, Phone, Mail, Shield, CheckCircle,
} from "lucide-react";
import { useLogoSrc } from "@/contexts/AppearanceContext";
import SEO from "@/components/SEO";

const API = import.meta.env.VITE_API_URL || "";
const BASE = import.meta.env.BASE_URL || "/";
const A = "#9fbcff";

type Step = "code" | "waiting-udid" | "form" | "submitting" | "success";

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
    groupName: string | null;
    isActive: string;
    planName: string | null;
    planNameAr: string | null;
  };
  storeDownloadLink: string | null;
  appleMessage?: string;
}

const inp =
  "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors";

function getOrCreateToken(): string {
  const saved = sessionStorage.getItem("activate_token");
  if (saved) return saved;
  const t = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
  sessionStorage.setItem("activate_token", t);
  return t;
}

export default function Activate() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlCode = urlParams.get("code") || "";
  const urlUdid = urlParams.get("udid") || "";
  const logoSrc = useLogoSrc();

  const [step, setStep] = useState<Step>("code");
  const [errorMsg, setErrorMsg] = useState("");
  const [token] = useState(() => getOrCreateToken());

  const [codeInput, setCodeInput] = useState(urlCode);
  const [codeLoading, setCodeLoading] = useState(false);
  const [validated, setValidated] = useState<ValidateResult | null>(null);

  const [udid, setUdid] = useState(urlUdid);
  const [udidFound, setUdidFound] = useState(!!urlUdid);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [successData, setSuccessData] = useState<SuccessData | null>(null);

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
    if (urlUdid) {
      foundRef.current = true;
      sessionStorage.setItem("activate_udid", urlUdid);
    } else {
      const savedUdid = sessionStorage.getItem("activate_udid");
      if (savedUdid && step === "code") {
        setUdid(savedUdid);
        setUdidFound(true);
        foundRef.current = true;
      }
    }
    if (urlCode) {
      doValidateCode(urlCode);
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
              groupName: s?.groupName || data.groupName,
              isActive: s?.isActive ?? "true",
              planName: s?.planName || data.planName,
              planNameAr: s?.planNameAr || null,
            },
            storeDownloadLink: s?.storeDownloadLink || data.downloadLink,
          });
        } catch {
          setSuccessData({
            subscriber: {
              id: data.subscriberId || 0, code: data.code, subscriberName: null,
              phone: null, email: null, udid: null, groupName: data.groupName,
              isActive: "true", planName: data.planName, planNameAr: null,
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
      <SEO
        title="تفعيل اشتراك مسماري — أدخل كود الاشتراك وابدأ فوراً"
        description="فعّل اشتراكك في مسماري بكود الاشتراك الخاص بك. أدخل الكود وثبّت التطبيقات على آيفونك في دقيقة واحدة. دعم تقني عربي متاح."
        keywords="تفعيل مسماري, كود مسماري, كود اشتراك مسماري, activate mismari, mismari code, كود تفعيل ايفون, تفعيل تطبيقات ايفون, activation code ios, مسماري كود تفعيل, تفعيل متجر التطبيقات العربي"
        canonical="/activate"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "تفعيل اشتراك مسماري",
          "url": "https://app.mismari.com/activate",
          "description": "صفحة تفعيل الاشتراك في مسماري. أدخل كود الاشتراك الخاص بك وابدأ بتحميل التطبيقات فوراً."
        }}
      />
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoSrc} alt="Mismari"
            className="h-12 w-auto object-contain mx-auto mb-2" />
          <p className="text-white/30 text-sm">تفعيل الاشتراك</p>
        </div>

        {/* ─── Step 1: Enter Code ─── */}
        {step === "code" && (
          <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${A}20` }}>
                <Key className="w-4 h-4" style={{ color: A }} />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">أدخل كود الاشتراك</h2>
                <p className="text-white/40 text-xs">الكود المرسل إليك من الإدارة</p>
              </div>
            </div>
            <form onSubmit={handleValidateCode} className="p-5 space-y-4">
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                placeholder="MSM-XXXX-XXXX"
                dir="ltr"
                className={inp + " text-center text-lg font-mono tracking-widest"}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              {errorMsg && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2.5">
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
                {codeLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحقق...</>
                  : <><Key className="w-4 h-4" /> تحقق من الكود</>}
              </button>
            </form>
          </div>
        )}

        {/* ─── Step 2: Downloading Profile + Waiting for UDID ─── */}
        {step === "waiting-udid" && (
          <div className="space-y-3">
            {/* Code badge */}
            {validated && (
              <div className="bg-[#111] border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-500/10">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm font-mono">{validated.code}</p>
                    <p className="text-white/40 text-xs">{validated.planName || "اشتراك فعّال"} ✓</p>
                  </div>
                </div>
              </div>
            )}

            {/* Spinner */}
            <div className="bg-[#111] border border-white/10 rounded-2xl px-6 py-10 text-center space-y-5">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div className="absolute inset-0 rounded-full border-t-2 animate-spin" style={{ borderColor: A }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-8 h-8" style={{ color: A }} />
                </div>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">جارٍ تحميل ملف التعريف</h2>
                <p className="text-white/40 text-sm mt-2 leading-relaxed">
                  ثبّت الملف من <strong className="text-white/60">الإعدادات ← عام ← VPN والإدارة</strong>
                  <br />ثم ارجع هنا تلقائياً
                </p>
              </div>
              <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3.5 text-right">
                <p className="text-yellow-400/70 text-xs leading-relaxed">
                  إذا ظهرت رسالة خطأ من iOS، اضغط <strong className="text-yellow-400">OK</strong> وارجع لهذه الصفحة
                </p>
              </div>

              {/* Manual download button in case auto-download fails */}
              <a
                href={profileUrl}
                className="block w-full py-3 rounded-xl text-sm font-semibold border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
              >
                <Download className="w-4 h-4 inline ml-2" />
                تحميل يدوي
              </a>
            </div>
          </div>
        )}

        {/* ─── Step 3: Info Form ─── */}
        {(step === "form" || step === "submitting") && validated && (
          <div className="space-y-3">
            {/* UDID detected */}
            {udidFound && udid ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-green-500/20 bg-green-500/5">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <p className="text-green-400/90 text-xs font-semibold">تم التعرف على جهازك ✓</p>
                  <p className="font-mono text-[10px] text-white/25 mt-0.5 truncate">{udid}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.02]">
                <Shield className="w-4 h-4 text-white/20 shrink-0" />
                <p className="text-white/30 text-xs">لم يتم التعرف على الجهاز — يمكنك إكمال البيانات بدونه</p>
              </div>
            )}

            {/* Form */}
            <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-white font-bold text-base">بياناتك الشخصية</h3>
                <p className="text-white/40 text-xs mt-0.5">أدخل معلوماتك لإتمام التسجيل</p>
              </div>
              <form onSubmit={handleCompleteRegistration} className="p-5 space-y-4">

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-white/50">
                    <User className="w-3.5 h-3.5" style={{ color: A }} />
                    الاسم الكامل <span style={{ color: A }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    className={inp}
                    dir="rtl"
                    autoComplete="name"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-white/50">
                    <Phone className="w-3.5 h-3.5" style={{ color: A }} />
                    رقم الهاتف <span style={{ color: A }}>*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="07XXXXXXXXX"
                    dir="ltr"
                    className={inp + " text-left font-mono"}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-white/50">
                    <Mail className="w-3.5 h-3.5" style={{ color: A }} />
                    البريد الإلكتروني
                    <span className="text-white/20 text-[10px]">(اختياري)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    dir="ltr"
                    className={inp + " text-left"}
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={step === "submitting"}
                  className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: A, color: "#000" }}
                >
                  {step === "submitting"
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التسجيل...</>
                    : <><Send className="w-4 h-4" /> إرسال وتفعيل الاشتراك</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── Step 4: Success + Download Link ─── */}
        {step === "success" && successData && (
          <div className="space-y-3">
            {/* Success header */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-xl mb-1">
                {validated?.alreadyRegistered ? "أنت مشترك بالفعل" : "تم التسجيل بنجاح!"}
              </h2>
              <p className="text-white/40 text-sm">
                مرحباً {successData.subscriber.subscriberName || "بك"}
              </p>
              {successData.appleMessage && (
                <p className="text-xs mt-3 px-3 py-1.5 rounded-lg inline-block"
                  style={{ background: `${A}15`, color: A }}>
                  {successData.appleMessage}
                </p>
              )}
            </div>

            {/* Info summary */}
            <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">بيانات الاشتراك</h3>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { label: "الاسم", value: successData.subscriber.subscriberName },
                  { label: "الهاتف", value: successData.subscriber.phone, mono: true },
                  { label: "البريد", value: successData.subscriber.email, mono: true },
                  { label: "الكود", value: successData.subscriber.code, mono: true },
                  { label: "الباقة", value: successData.subscriber.planNameAr || successData.subscriber.planName },
                  { label: "المجموعة", value: successData.subscriber.groupName },
                  { label: "الحالة", value: successData.subscriber.isActive === "true" ? "فعّال ✓" : "غير فعّال" },
                ].filter(r => r.value).map(({ label, value, mono }) => (
                  <div key={label} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-white/40 text-xs">{label}</span>
                    <span className={`text-white text-sm ${mono ? "font-mono text-xs" : ""}`}
                      dir={mono ? "ltr" : "rtl"}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Install App Section */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: `${A}15` }}>
                <Smartphone className="w-8 h-8" style={{ color: A }} />
              </div>
              <h3 className="text-white text-lg font-bold">مسماري+</h3>

              {successData.storeDownloadLink ? (
                <>
                  <a
                    href={successData.storeDownloadLink}
                    className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold transition-all active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${A}, #7aa3ff)`, color: "#000" }}
                  >
                    <Download className="w-5 h-5" />
                    تثبيت التطبيق
                  </a>
                  <p className="text-white/30 text-xs text-center">
                    اضغط على "ثقة" في إعدادات الجهاز بعد التثبيت
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-white/40 text-sm">سيتم إرسال رابط التثبيت قريباً</p>
                  <p className="text-white/20 text-xs mt-1">تواصل مع الإدارة للحصول على الرابط</p>
                </div>
              )}
            </div>

            {/* Install Instructions */}
            {successData.storeDownloadLink && (
              <div className="w-full rounded-2xl p-4 border"
                style={{ background: "#0a0a0a", borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="text-white/40 text-xs font-semibold mb-3">خطوات التثبيت</p>
                {[
                  "اضغط على زر التثبيت أعلاه",
                  "اسمح للمتصفح بفتح رابط التطبيق",
                  "اضغط \"ثقة\" عند ظهور رسالة التأكيد",
                  "انتظر اكتمال التثبيت",
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 py-1.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      style={{ background: `${A}20`, color: A }}>{i + 1}</span>
                    <p className="text-white/50 text-xs">{s}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-white/15 text-xs text-center mt-2">
              يجب فتح هذه الصفحة من Safari على iPhone أو iPad
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
