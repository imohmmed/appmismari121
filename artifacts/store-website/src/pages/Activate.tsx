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
const T = "#2b283b";

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
  "w-full bg-white border rounded-xl px-4 py-3.5 text-sm focus:outline-none transition-colors";

const inpStyle = {
  borderColor: `${T}18`,
  color: T,
};

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#ffffff", direction: "rtl" }}>
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
          <p className="text-sm" style={{ color: `${T}50` }}>تفعيل الاشتراك</p>
        </div>

        {/* ─── Step 1: Enter Code ─── */}
        {step === "code" && (
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${T}12` }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${T}08` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${A}20` }}>
                <Key className="w-4 h-4" style={{ color: A }} />
              </div>
              <div>
                <h2 className="font-bold text-base" style={{ color: T }}>أدخل كود الاشتراك</h2>
                <p className="text-xs" style={{ color: `${T}50` }}>الكود المرسل إليك من الإدارة</p>
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
                style={{ ...inpStyle, borderColor: `${T}18` }}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              {errorMsg && (
                <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2.5" style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={codeLoading || !codeInput.trim()}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95"
                style={{ background: A, color: T }}
              >
                {codeLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحقق...</>
                  : <><Key className="w-4 h-4" /> تحقق من الكود</>}
              </button>
            </form>
          </div>
        )}

        {/* ─── Step 2: Waiting for UDID ─── */}
        {step === "waiting-udid" && (
          <div className="space-y-3">
            {validated && (
              <div className="bg-white border rounded-2xl p-4 flex items-center justify-between shadow-sm" style={{ borderColor: `${T}12` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-50 border border-green-200">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm font-mono" style={{ color: T }}>{validated.code}</p>
                    <p className="text-xs" style={{ color: `${T}50` }}>{validated.planName || "اشتراك فعّال"} ✓</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border rounded-2xl px-6 py-10 text-center space-y-5 shadow-sm" style={{ borderColor: `${T}12` }}>
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: `${T}10` }} />
                <div className="absolute inset-0 rounded-full border-t-2 animate-spin" style={{ borderColor: A }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-8 h-8" style={{ color: A }} />
                </div>
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: T }}>جارٍ تحميل ملف التعريف</h2>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: `${T}55` }}>
                  ثبّت الملف من <strong style={{ color: T }}>الإعدادات ← عام ← VPN والإدارة</strong>
                  <br />ثم ارجع هنا تلقائياً
                </p>
              </div>
              <div className="rounded-xl p-3.5 text-right" style={{ background: "#fffbeb", border: "1px solid #fcd34d40" }}>
                <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
                  إذا ظهرت رسالة خطأ من iOS، اضغط <strong>OK</strong> وارجع لهذه الصفحة
                </p>
              </div>
              <a
                href={profileUrl}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold border transition-all"
                style={{ borderColor: `${T}15`, color: `${T}60` }}
              >
                <Download className="w-4 h-4" />
                تحميل يدوي
              </a>
            </div>
          </div>
        )}

        {/* ─── Step 3: Info Form ─── */}
        {(step === "form" || step === "submitting") && validated && (
          <div className="space-y-3">
            {udidFound && udid ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-green-200 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-green-700 text-xs font-semibold">تم التعرف على جهازك ✓</p>
                  <p className="font-mono text-[10px] mt-0.5 truncate" style={{ color: `${T}40` }}>{udid}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border" style={{ borderColor: `${T}10`, background: `${T}03` }}>
                <Shield className="w-4 h-4 shrink-0" style={{ color: `${T}30` }} />
                <p className="text-xs" style={{ color: `${T}45` }}>لم يتم التعرف على الجهاز — يمكنك إكمال البيانات بدونه</p>
              </div>
            )}

            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${T}12` }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T}08` }}>
                <h3 className="font-bold text-base" style={{ color: T }}>بياناتك الشخصية</h3>
                <p className="text-xs mt-0.5" style={{ color: `${T}50` }}>أدخل معلوماتك لإتمام التسجيل</p>
              </div>
              <form onSubmit={handleCompleteRegistration} className="p-5 space-y-4">

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: `${T}55` }}>
                    <User className="w-3.5 h-3.5" style={{ color: A }} />
                    الاسم الكامل <span style={{ color: A }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    className={inp}
                    style={inpStyle}
                    dir="rtl"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: `${T}55` }}>
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
                    style={inpStyle}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: `${T}55` }}>
                    <Mail className="w-3.5 h-3.5" style={{ color: A }} />
                    البريد الإلكتروني
                    <span className="text-[10px]" style={{ color: `${T}35` }}>(اختياري)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    dir="ltr"
                    className={inp + " text-left"}
                    style={inpStyle}
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2.5" style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca" }}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={step === "submitting"}
                  className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                  style={{ background: A, color: T }}
                >
                  {step === "submitting"
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التسجيل...</>
                    : <><Send className="w-4 h-4" /> إرسال وتفعيل الاشتراك</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── Step 4: Success ─── */}
        {step === "success" && successData && (
          <div className="space-y-3">
            <div className="bg-white border rounded-2xl p-6 text-center shadow-sm" style={{ borderColor: `${T}12` }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-50 border border-green-200">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="font-bold text-xl mb-1" style={{ color: T }}>
                {validated?.alreadyRegistered ? "أنت مشترك بالفعل" : "تم التسجيل بنجاح!"}
              </h2>
              <p className="text-sm" style={{ color: `${T}55` }}>
                مرحباً {successData.subscriber.subscriberName || "بك"}
              </p>
              {successData.appleMessage && (
                <p className="text-xs mt-3 px-3 py-1.5 rounded-lg inline-block"
                  style={{ background: `${A}15`, color: A }}>
                  {successData.appleMessage}
                </p>
              )}
            </div>

            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${T}12` }}>
              <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T}08` }}>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: `${T}45` }}>بيانات الاشتراك</h3>
              </div>
              <div>
                {[
                  { label: "الاسم", value: successData.subscriber.subscriberName },
                  { label: "الهاتف", value: successData.subscriber.phone, mono: true },
                  { label: "البريد", value: successData.subscriber.email, mono: true },
                  { label: "الكود", value: successData.subscriber.code, mono: true },
                  { label: "الباقة", value: successData.subscriber.planNameAr || successData.subscriber.planName },
                  { label: "المجموعة", value: successData.subscriber.groupName },
                  { label: "الحالة", value: successData.subscriber.isActive === "true" ? "فعّال ✓" : "غير فعّال" },
                ].filter(r => r.value).map(({ label, value, mono }, i, arr) => (
                  <div key={label} className="px-5 py-3 flex items-center justify-between"
                    style={{ borderBottom: i < arr.length - 1 ? `1px solid ${T}08` : "none" }}>
                    <span className="text-xs" style={{ color: `${T}45` }}>{label}</span>
                    <span className={`text-sm ${mono ? "font-mono text-xs" : ""}`}
                      style={{ color: T }}
                      dir={mono ? "ltr" : "rtl"}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-6 flex flex-col items-center gap-4 shadow-sm" style={{ borderColor: `${T}12` }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: `${A}15` }}>
                <Smartphone className="w-8 h-8" style={{ color: A }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: T }}>مسماري+</h3>

              {successData.storeDownloadLink ? (
                <>
                  <a
                    href={successData.storeDownloadLink}
                    className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold transition-all active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${A}, #7aa3ff)`, color: T }}
                  >
                    <Download className="w-5 h-5" />
                    تثبيت التطبيق
                  </a>
                  <p className="text-xs text-center" style={{ color: `${T}45` }}>
                    اضغط على "ثقة" في إعدادات الجهاز بعد التثبيت
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm" style={{ color: `${T}55` }}>سيتم إرسال رابط التثبيت قريباً</p>
                  <p className="text-xs mt-1" style={{ color: `${T}35` }}>تواصل مع الإدارة للحصول على الرابط</p>
                </div>
              )}
            </div>

            {successData.storeDownloadLink && (
              <div className="w-full rounded-2xl p-4 border" style={{ background: `${A}08`, borderColor: `${A}25` }}>
                <p className="text-xs font-bold mb-2" style={{ color: T }}>خطوات التثبيت:</p>
                <ol className="space-y-1.5">
                  {[
                    "اضغط على زر تثبيت التطبيق أعلاه",
                    "انتظر حتى يكتمل التحميل",
                    "اذهب إلى الإعدادات ← عام ← إدارة الجهاز",
                    "اضغط على اسم المطور ثم اختر «ثقة»",
                    "ارجع وافتح التطبيق",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: `${T}65` }}>
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: `${A}30`, color: A }}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
