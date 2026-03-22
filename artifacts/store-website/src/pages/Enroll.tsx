import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Loader2, CheckCircle2, Send, AlertCircle,
  ArrowLeft, Package, Download, Shield, CheckCircle,
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

type PageStep = "form" | "submitting" | "success" | "error";

function getOrCreateToken(): string {
  const saved = sessionStorage.getItem("enroll_token");
  if (saved) return saved;
  const t = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
  sessionStorage.setItem("enroll_token", t);
  return t;
}

export default function Enroll() {
  const [, navigate] = useLocation();
  const urlUdid = new URLSearchParams(window.location.search).get("udid") || "";
  const urlPlan = new URLSearchParams(window.location.search).get("plan") || "";

  const [step, setStep] = useState<PageStep>("form");
  const [token] = useState(() => getOrCreateToken());
  const [plans, setPlans] = useState<Plan[]>([]);

  const [udid, setUdid] = useState(urlUdid);
  const [udidStatus, setUdidStatus] = useState<"idle" | "waiting" | "found">(
    urlUdid ? "found" : "idle"
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deviceType, setDeviceType] = useState("iPhone");
  const [planId, setPlanId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foundRef = useRef(!!urlUdid);
  const downloadedRef = useRef(false);

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
  }, []);

  const pollOnce = useCallback(async () => {
    if (foundRef.current) return;
    try {
      const r = await fetch(`${API}/api/profile/udid-check?token=${token}`, { cache: "no-store" });
      const d = await r.json();
      if (d.found && d.udid) {
        foundRef.current = true;
        clearInterval(pollingRef.current!);
        setUdid(d.udid);
        setUdidStatus("found");
        sessionStorage.setItem("enroll_udid", d.udid);
      }
    } catch {}
  }, [token]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setUdidStatus("waiting");
    foundRef.current = false;
    pollingRef.current = setInterval(pollOnce, 2500);
    pollOnce();
  }, [pollOnce]);

  useEffect(() => {
    const savedUdid = sessionStorage.getItem("enroll_udid");
    if (savedUdid && !urlUdid) {
      setUdid(savedUdid);
      setUdidStatus("found");
      foundRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (udidStatus !== "waiting") return;
    const onVisible = () => {
      if (!document.hidden) pollOnce();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [udidStatus, pollOnce]);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const selectedPlan = plans.find(p => p.id === planId);
  const planLabel = selectedPlan ? (selectedPlan.nameAr || selectedPlan.name) : "";
  const profileUrl = `${API}/api/profile/enroll?source=web&token=${encodeURIComponent(token)}${planLabel ? `&plan=${encodeURIComponent(planLabel)}` : ""}`;

  const handleDownload = () => {
    if (!downloadedRef.current) {
      downloadedRef.current = true;
      startPolling();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!udid) { setFormError("يرجى تحميل وتثبيت ملف التعريف أولاً للحصول على معرّف جهازك"); return; }
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
      <div className="w-full max-w-md space-y-4">

        {/* Logo */}
        <div className="text-center mb-2">
          <img src={`${BASE}mismari-logo-final.png`} alt="مسماري"
            className="h-10 w-auto object-contain mx-auto mb-1" />
          <p className="text-white/30 text-xs">طلب اشتراك</p>
        </div>

        {/* Success */}
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
                <p className="text-white/30 text-xs mb-1">معرّف جهازك المسجل</p>
                <p className="font-mono text-xs text-white/40 break-all">{udid}</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="bg-[#0a0a0a] border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h2 className="text-white font-bold text-xl mb-2">حدث خطأ</h2>
              <p className="text-white/50 text-sm">تعذّر إرسال طلبك، يرجى المحاولة مجدداً.</p>
            </div>
            <button onClick={() => setStep("form")}
              className="flex items-center gap-2 mx-auto text-sm text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> إعادة المحاولة
            </button>
          </div>
        )}

        {/* Main Form */}
        {(step === "form" || step === "submitting") && (
          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Profile download / UDID status card */}
            {udidStatus === "idle" && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" style={{ color: A }} />
                    <p className="text-white/70 text-sm font-medium">ابدأ بتحديد جهازك</p>
                  </div>
                  <p className="text-white/30 text-xs leading-relaxed">
                    حمّل ملف التعريف وثبّته من الإعدادات — سيتعرف الموقع على جهازك تلقائياً.
                  </p>
                  <a href={profileUrl} onClick={handleDownload}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold"
                    style={{ background: A, color: "#000" }}>
                    <Download className="w-4 h-4" />
                    تحميل ملف التعريف
                  </a>
                </div>
              </div>
            )}

            {udidStatus === "waiting" && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 shrink-0 animate-spin" style={{ color: A }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-sm font-medium">في انتظار التثبيت...</p>
                      <p className="text-white/30 text-xs mt-0.5">
                        ثبّت الملف من الإعدادات ثم ارجع هنا — ستظهر بياناتك تلقائياً
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                    <p className="text-yellow-400/60 text-xs leading-relaxed">
                      إذا ظهرت رسالة خطأ من iOS — اضغط <strong>OK</strong> وارجع هنا مباشرة
                    </p>
                  </div>
                </div>
              </div>
            )}

            {udidStatus === "found" && (
              <div className="bg-[#0a0a0a] border border-green-500/20 rounded-2xl overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 shrink-0 text-green-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-green-400/80 text-sm font-medium">تم التعرف على جهازك ✓</p>
                    <p className="font-mono text-xs text-white/30 mt-0.5 truncate">{udid}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Personal info */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-white font-bold text-sm">البيانات الشخصية</h2>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">الاسم الكامل *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="أدخل اسمك الكامل" className={inp}
                    style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", direction: "rtl" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">رقم الهاتف *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX" dir="ltr" className={inp + " text-left font-mono"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">البريد الإلكتروني</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="email@example.com" dir="ltr" className={inp + " text-left"} />
                </div>
              </div>
            </div>

            {/* Device type */}
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-white font-bold text-sm">نوع الجهاز</h2>
              </div>
              <div className="p-5">
                <div className="flex gap-2">
                  {["iPhone", "iPad", "Mac"].map(type => (
                    <button key={type} type="button" onClick={() => setDeviceType(type)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all"
                      style={deviceType === type
                        ? { background: `${A}20`, color: A, borderColor: `${A}40` }
                        : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.08)" }
                      }>{type}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Plans */}
            {plans.length > 0 && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <h2 className="text-white font-bold text-sm flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" style={{ color: A }} />
                    الباقة المطلوبة
                  </h2>
                </div>
                <div className="p-5 space-y-2">
                  {plans.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => setPlanId(p.id === planId ? "" : p.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border transition-all"
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
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-white font-bold text-sm">ملاحظات (اختياري)</h2>
              </div>
              <div className="p-5">
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="أي معلومات إضافية..." rows={3}
                  className={inp + " resize-none"}
                  style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif", direction: "rtl" }} />
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-red-400 text-xs px-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <button type="submit" disabled={step === "submitting"}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
              style={{ background: A, color: "#000" }}>
              {step === "submitting"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {step === "submitting" ? "جارٍ الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
