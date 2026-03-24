import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, CheckCircle2, Send, AlertCircle,
  Download, Shield, CheckCircle,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const BASE = import.meta.env.BASE_URL || "/";
const A = "#9fbcff";

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

  const inp = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <img src={`${BASE}mismari-logo.png`} alt="مسماري"
            className="h-10 w-auto object-contain mx-auto mb-1" />
          <p className="text-white/30 text-xs">طلب اشتراك</p>
        </div>

        {/* ── DOWNLOAD ── */}
        {step === "download" && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: `${A}15`, border: `1px solid ${A}20` }}>
                <Shield className="w-7 h-7" style={{ color: A }} />
              </div>
              <h2 className="text-white font-bold text-lg">تعريف الجهاز</h2>
              <p className="text-white/40 text-sm mt-1 leading-relaxed">
                حمّل وثبّت ملف التعريف ليتعرف الموقع على جهازك تلقائياً
              </p>
            </div>
            <div className="p-6 space-y-4">
              {plans.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-white/30 mb-2">اختر الباقة (اختياري)</p>
                  <div className="space-y-2">
                    {plans.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => setPlanId(p.id === planId ? "" : p.id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
                        style={planId === p.id
                          ? { background: `${A}15`, borderColor: `${A}40`, color: A }
                          : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
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
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-base font-bold"
                style={{ background: A, color: "#000" }}>
                <Download className="w-5 h-5" />
                تحميل ملف التعريف
              </a>
              <p className="text-white/20 text-xs text-center leading-relaxed">
                الملف موقّع من app.mismari.com ولا يُثبَّت أي تطبيق
              </p>
            </div>
          </div>
        )}

        {/* ── WAITING ── */}
        {step === "waiting" && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-8 text-center space-y-5">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div className="absolute inset-0 rounded-full border-t-2 animate-spin"
                  style={{ borderColor: A }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-6 h-6" style={{ color: A }} />
                </div>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">في انتظار التثبيت</h2>
                <p className="text-white/40 text-sm mt-1 leading-relaxed">
                  ثبّت الملف من الإعدادات، وارجع هنا بعد الانتهاء
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
        )}

        {/* ── FORM ── */}
        {(step === "form" || step === "submitting") && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* UDID confirmed */}
            {udid && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-green-400/90 text-xs font-medium">تم التعرف على جهازك</p>
                  <p className="font-mono text-xs text-white/30 mt-0.5 truncate">{udid}</p>
                </div>
              </div>
            )}

            {/* Personal info */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/5">
                <h2 className="text-white font-semibold text-sm">بيانات طلب الاشتراك</h2>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs text-white/30 mb-1.5">الاسم الكامل *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="أدخل اسمك الكامل" className={inp}
                    style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", direction: "rtl" }} />
                </div>
                <div>
                  <label className="block text-xs text-white/30 mb-1.5">رقم الهاتف *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX" dir="ltr" className={inp + " text-left font-mono"} />
                </div>
                <div>
                  <label className="block text-xs text-white/30 mb-1.5">البريد الإلكتروني</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com" dir="ltr" className={inp + " text-left"} />
                </div>
              </div>
            </div>

            {/* Device type */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-white/30 mb-2.5">نوع الجهاز</p>
              <div className="flex gap-2">
                {["iPhone", "iPad"].map(type => (
                  <button key={type} type="button" onClick={() => setDeviceType(type)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={deviceType === type
                      ? { background: `${A}20`, color: A, borderColor: `${A}40` }
                      : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }
                    }>{type}</button>
                ))}
              </div>
            </div>

            {/* Plan */}
            {plans.length > 0 && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/5">
                  <h2 className="text-white font-semibold text-sm">الباقة</h2>
                </div>
                <div className="p-4 space-y-2">
                  {plans.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => setPlanId(p.id === planId ? "" : p.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
                      style={planId === p.id
                        ? { background: `${A}15`, borderColor: `${A}40` }
                        : { background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.07)" }
                      }>
                      <p className="text-sm font-medium" style={{ color: planId === p.id ? A : "rgba(255,255,255,0.75)" }}>
                        {p.nameAr || p.name}
                      </p>
                      {p.price != null && (
                        <span className="text-sm font-bold" style={{ color: planId === p.id ? A : "rgba(255,255,255,0.35)" }}>
                          {p.price === 0 ? "مجاني" : `${p.price} ${p.currency || ""}`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5">
              <label className="block text-xs text-white/30 mb-1.5">ملاحظات (اختياري)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="أي معلومات إضافية..." rows={3}
                className={inp + " resize-none"}
                style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", direction: "rtl" }} />
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-red-400 text-xs px-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button type="submit" disabled={step === "submitting"}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: A, color: "#000" }}>
              {step === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {step === "submitting" ? "جارٍ الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        )}

        {/* ── SUCCESS ── */}
        {step === "success" && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "#34C75920", border: "1px solid #34C75940" }}>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl mb-2">تم إرسال طلبك ✓</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                سيتواصل معك فريق مسماري في أقرب وقت لتفعيل اشتراكك.
              </p>
            </div>
            {udid && (
              <div className="bg-black/30 rounded-xl p-3">
                <p className="text-white/30 text-xs mb-1">معرّف جهازك</p>
                <p className="font-mono text-xs text-white/40 break-all">{udid}</p>
              </div>
            )}
          </div>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div className="bg-[#0a0a0a] border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h2 className="text-white font-bold text-xl mb-2">حدث خطأ</h2>
              <p className="text-white/50 text-sm">تعذّر إرسال طلبك، يرجى المحاولة مجدداً.</p>
            </div>
            <button onClick={() => setStep("form")}
              className="text-sm text-white/40 hover:text-white transition-colors">
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
