import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, CheckCircle2, Send, AlertCircle,
  Download, Shield, CheckCircle,
} from "lucide-react";
import { useLogoSrc } from "@/contexts/AppearanceContext";
import SEO from "@/components/SEO";

const API = import.meta.env.VITE_API_URL || "";
const BASE = import.meta.env.BASE_URL || "/";
const A = "#9fbcff";
const T = "#2b283b";

interface Plan {
  id: number;
  name: string;
  nameAr: string | null;
  price: number | null;
  currency?: string;
}

type Step = "download" | "waiting" | "form" | "submitting" | "success" | "error";

function getOrCreateToken(): string {
  const saved = sessionStorage.getItem("enroll_token");
  if (saved) return saved;
  const t = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
  sessionStorage.setItem("enroll_token", t);
  return t;
}

export default function Enroll() {
  const urlUdid = new URLSearchParams(window.location.search).get("udid") || "";
  const urlPlan = new URLSearchParams(window.location.search).get("plan") || "";
  const autoDownload = new URLSearchParams(window.location.search).get("auto") === "1";
  const logoSrc = useLogoSrc();

  const [step, setStep] = useState<Step>(urlUdid ? "form" : (autoDownload ? "waiting" : "download"));
  const [token] = useState(() => getOrCreateToken());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [udid, setUdid] = useState(urlUdid);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deviceType, setDeviceType] = useState("iPhone");
  const [planId, setPlanId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foundRef = useRef(!!urlUdid);
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    fetch(`${API}/api/subscriptions/plans`)
      .then(r => r.json())
      .then(d => {
        const list: Plan[] = d?.plans || [];
        setPlans(list);
        if (urlPlan) {
          const match = list.find(p => p.name === urlPlan || p.nameAr === urlPlan);
          if (match) setPlanId(match.id);
        }
      })
      .catch(() => {});

    const savedUdid = sessionStorage.getItem("enroll_udid");
    if (savedUdid && !urlUdid) {
      setUdid(savedUdid);
      foundRef.current = true;
      setStep("form");
      return;
    }

    if (autoDownload && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
    }
  }, []);

  const pollOnce = useCallback(async () => {
    if (foundRef.current) return;
    try {
      const r = await fetch(`${API}/api/profile/udid-check?token=${token}`, { cache: "no-store" });
      const d = await r.json();
      if (d.found && d.udid) {
        foundRef.current = true;
        clearInterval(pollingRef.current!);
        sessionStorage.setItem("enroll_udid", d.udid);
        setUdid(d.udid);
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
    if (step !== "waiting") return;
    startPolling();
    const onVisible = () => { if (!document.hidden) pollOnce(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step]);

  const selectedPlan = plans.find(p => p.id === planId);
  const planLabel = selectedPlan ? (selectedPlan.nameAr || selectedPlan.name) : "";
  const profileUrl = `${API}/api/profile/enroll?source=web&token=${encodeURIComponent(token)}${planLabel ? `&plan=${encodeURIComponent(planLabel)}` : ""}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormError("الاسم مطلوب"); return; }
    if (!phone.trim()) { setFormError("رقم الهاتف مطلوب"); return; }
    setFormError("");
    setStep("submitting");
    try {
      const res = await fetch(`${API}/api/enroll/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          udid,
          deviceType,
          planId: planId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      sessionStorage.removeItem("enroll_token");
      sessionStorage.removeItem("enroll_udid");
      setStep("success");
    } catch {
      setStep("error");
    }
  };

  const inp = `w-full bg-white border border-[#2b283b]/15 rounded-xl px-4 py-3 text-[${T}] text-sm placeholder:text-[#2b283b]/30 focus:outline-none focus:border-[#9fbcff]/60 transition-colors`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#ffffff", direction: "rtl" }}>
      <SEO
        title="اشتراك مسماري — سجّل وابدأ تحميل تطبيقات الآيفون مجاناً"
        description="سجّل في مسماري الآن واحصل على اشتراك فوري. تمتع بتحميل آلاف التطبيقات والألعاب المدفوعة مجاناً على آيفونك بدون جيلبريك. سجّل UDID جهازك بخطوات بسيطة."
        keywords="اشتراك مسماري, سجل في مسماري, تسجيل مسماري, مسماري اشتراك جديد, تحميل مسماري, تفعيل مسماري, UDID ايفون, تسجيل UDID, enroll iphone, subscribe mismari, مسماري بدون جيلبريك, تطبيقات ايفون مجانا اشتراك, iOS subscription arabic"
        canonical="/enroll"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "اشتراك مسماري — سجّل وابدأ تحميل تطبيقات الآيفون",
          "url": "https://app.mismari.com/enroll",
          "description": "صفحة التسجيل والاشتراك في مسماري. سجّل بياناتك واحصل على اشتراك فوري في متجر تطبيقات الآيفون العربي."
        }}
      />
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <img src={logoSrc} alt="مسماري"
            className="h-10 w-auto object-contain mx-auto mb-1" />
          <p className="text-xs" style={{ color: `${T}50` }}>طلب اشتراك</p>
        </div>

        {/* ── DOWNLOAD ── */}
        {step === "download" && (
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${T}12` }}>
            <div className="px-6 py-5 text-center" style={{ borderBottom: `1px solid ${T}10` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: `${A}18`, border: `1px solid ${A}30` }}>
                <Shield className="w-7 h-7" style={{ color: A }} />
              </div>
              <h2 className="font-bold text-lg" style={{ color: T }}>تعريف الجهاز</h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: `${T}60` }}>
                حمّل وثبّت ملف التعريف ليتعرف الموقع على جهازك تلقائياً
              </p>
            </div>
            <div className="p-6 space-y-4">
              {plans.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: `${T}50` }}>اختر الباقة (اختياري)</p>
                  <div className="space-y-2">
                    {plans.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => setPlanId(p.id === planId ? "" : p.id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
                        style={planId === p.id
                          ? { background: `${A}15`, borderColor: `${A}40`, color: A }
                          : { background: `${T}04`, borderColor: `${T}12`, color: `${T}70` }
                        }>
                        <span className="text-sm font-medium">{p.nameAr || p.name}</span>
                        {p.price != null && (
                          <span className="text-sm font-bold">
                            {p.price === 0 ? "مجاني" : `${p.price} ${p.currency || ""}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <a href={profileUrl}
                onClick={() => setStep("waiting")}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-base font-bold transition-all active:scale-95"
                style={{ background: A, color: T }}>
                <Download className="w-5 h-5" />
                تحميل ملف التعريف
              </a>
              <p className="text-xs text-center leading-relaxed" style={{ color: `${T}35` }}>
                الملف موقّع من app.mismari.com ولا يُثبَّت أي تطبيق
              </p>
            </div>
          </div>
        )}

        {/* ── WAITING ── */}
        {step === "waiting" && (
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${T}12` }}>
            <div className="px-6 py-8 text-center space-y-5">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: `${T}10` }} />
                <div className="absolute inset-0 rounded-full border-t-2 animate-spin"
                  style={{ borderColor: A }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-6 h-6" style={{ color: A }} />
                </div>
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: T }}>في انتظار التثبيت</h2>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: `${T}55` }}>
                  ثبّت الملف من الإعدادات، وارجع هنا بعد الانتهاء
                </p>
              </div>
              <div className="rounded-xl p-4 text-right" style={{ background: "#fffbeb", border: "1px solid #fcd34d40" }}>
                <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
                  قد تظهر رسالة خطأ من iOS — اضغط <strong>OK</strong> وارجع لهذه الصفحة وستتحدث تلقائياً
                </p>
              </div>
              <p className="text-xs" style={{ color: `${T}35` }}>سيظهر الفورم تلقائياً بعد التثبيت</p>
            </div>
          </div>
        )}

        {/* ── FORM ── */}
        {(step === "form" || step === "submitting") && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {udid && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/30 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-green-700 text-xs font-medium">تم التعرف على جهازك</p>
                  <p className="font-mono text-xs mt-0.5 truncate" style={{ color: `${T}40` }}>{udid}</p>
                </div>
              </div>
            )}

            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${T}12` }}>
              <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${T}08` }}>
                <h2 className="font-semibold text-sm" style={{ color: T }}>بيانات طلب الاشتراك</h2>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: `${T}50` }}>الاسم الكامل *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="أدخل اسمك الكامل" className={inp}
                    style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", direction: "rtl", color: T }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: `${T}50` }}>رقم الهاتف *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX" dir="ltr" className={inp + " text-left font-mono"} style={{ color: T }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: `${T}50` }}>البريد الإلكتروني</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com" dir="ltr" className={inp + " text-left"} style={{ color: T }} />
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-4 shadow-sm" style={{ borderColor: `${T}12` }}>
              <p className="text-xs mb-2.5" style={{ color: `${T}50` }}>نوع الجهاز</p>
              <div className="flex gap-2">
                {["iPhone", "iPad"].map(type => (
                  <button key={type} type="button" onClick={() => setDeviceType(type)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={deviceType === type
                      ? { background: `${A}20`, color: A, borderColor: `${A}40` }
                      : { background: "transparent", color: `${T}45`, borderColor: `${T}15` }
                    }>{type}</button>
                ))}
              </div>
            </div>

            {plans.length > 0 && (
              <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${T}12` }}>
                <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${T}08` }}>
                  <h2 className="font-semibold text-sm" style={{ color: T }}>الباقة</h2>
                </div>
                <div className="p-4 space-y-2">
                  {plans.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => setPlanId(p.id === planId ? "" : p.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
                      style={planId === p.id
                        ? { background: `${A}15`, borderColor: `${A}40` }
                        : { background: `${T}03`, borderColor: `${T}10` }
                      }>
                      <p className="text-sm font-medium" style={{ color: planId === p.id ? A : `${T}80` }}>
                        {p.nameAr || p.name}
                      </p>
                      {p.price != null && (
                        <span className="text-sm font-bold" style={{ color: planId === p.id ? A : `${T}45` }}>
                          {p.price === 0 ? "مجاني" : `${p.price} ${p.currency || ""}`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border rounded-2xl p-5 shadow-sm" style={{ borderColor: `${T}12` }}>
              <label className="block text-xs mb-1.5" style={{ color: `${T}50` }}>ملاحظات (اختياري)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="أي معلومات إضافية..." rows={3}
                className={inp + " resize-none"}
                style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", direction: "rtl", color: T }} />
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-xs px-1" style={{ color: "#dc2626" }}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button type="submit" disabled={step === "submitting"}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
              style={{ background: A, color: T }}>
              {step === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {step === "submitting" ? "جارٍ الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        )}

        {/* ── SUCCESS ── */}
        {step === "success" && (
          <div className="bg-white border rounded-2xl p-8 text-center space-y-4 shadow-sm" style={{ borderColor: `${T}12` }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-green-50 border border-green-200">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-xl mb-2" style={{ color: T }}>تم إرسال طلبك ✓</h2>
              <p className="text-sm leading-relaxed" style={{ color: `${T}55` }}>
                سيتواصل معك فريق مسماري في أقرب وقت لتفعيل اشتراكك.
              </p>
            </div>
            {udid && (
              <div className="rounded-xl p-3" style={{ background: `${T}06` }}>
                <p className="text-xs mb-1" style={{ color: `${T}40` }}>معرّف جهازك</p>
                <p className="font-mono text-xs break-all" style={{ color: `${T}50` }}>{udid}</p>
              </div>
            )}
          </div>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div className="bg-white border border-red-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h2 className="font-bold text-xl mb-2" style={{ color: T }}>حدث خطأ</h2>
              <p className="text-sm" style={{ color: `${T}55` }}>تعذّر إرسال طلبك، يرجى المحاولة مجدداً.</p>
            </div>
            <button onClick={() => setStep("form")}
              className="text-sm transition-colors hover:opacity-70"
              style={{ color: `${T}50` }}>
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
