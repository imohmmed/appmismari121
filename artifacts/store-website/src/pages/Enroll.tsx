import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Loader2, CheckCircle2, Smartphone, Send, AlertCircle,
  ArrowLeft, Package, Download, Shield, CheckCircle,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const BASE = import.meta.env.BASE_URL || "/";
const A = "#9fbcff";

interface CheckResult {
  found: boolean;
  subscriber?: {
    id: number;
    code: string;
    subscriberName: string | null;
    isActive: string;
    expiresAt: string | null;
  };
}

interface Plan {
  id: number;
  name: string;
  nameAr: string | null;
  price: number | null;
  currency?: string;
  duration?: string;
}

type Step =
  | "waiting-udid"
  | "udid-found"
  | "checking"
  | "already-subscribed"
  | "form"
  | "submitting"
  | "success"
  | "error";

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 20);
}

export default function Enroll() {
  const [, navigate] = useLocation();
  const urlUdid = new URLSearchParams(window.location.search).get("udid") || "";

  const [step, setStep] = useState<Step>(urlUdid ? "checking" : "waiting-udid");
  const [udid, setUdid] = useState(urlUdid);
  const [token] = useState(() => generateToken());
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pollCount, setPollCount] = useState(0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [deviceType, setDeviceType] = useState("iPhone");
  const [planId, setPlanId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API}/api/subscriptions/plans`)
      .then(r => r.json())
      .then(d => setPlans(d?.plans || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (urlUdid) {
      checkUdid(urlUdid);
    }
  }, [urlUdid]);

  useEffect(() => {
    if (step !== "waiting-udid") return;
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/profile/udid-check?token=${token}`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (d.found && d.udid) {
          clearInterval(pollingRef.current!);
          setUdid(d.udid);
          setStep("checking");
          await checkUdid(d.udid);
        } else {
          setPollCount(c => c + 1);
        }
      } catch {}
    }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [step, token]);

  async function checkUdid(id: string) {
    try {
      const r = await fetch(`${API}/api/enroll/check?udid=${encodeURIComponent(id)}`);
      const data: CheckResult = await r.json();
      setCheckResult(data);
      setStep(data.found ? "already-subscribed" : "form");
    } catch {
      setStep("form");
    }
  }

  const profileUrl = `${API}/api/profile/enroll?source=web&token=${encodeURIComponent(token)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!udid) { setError("لم يتم الحصول على UDID — يرجى إعادة المحاولة"); return; }
    if (!name.trim()) { setError("الاسم مطلوب"); return; }
    if (!phone.trim()) { setError("رقم الهاتف مطلوب"); return; }
    setError("");
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
      if (!res.ok) throw new Error("Server error");
      setStep("success");
    } catch {
      setStep("error");
    }
  };

  const inp = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={`${BASE}mismari-logo-final.png`}
            alt="مسماري"
            className="h-12 w-auto object-contain mx-auto mb-3"
          />
          <p className="text-white/40 text-sm">تسجيل طلب الاشتراك</p>
        </div>

        {/* ── STEP 1: waiting for UDID ── */}
        {step === "waiting-udid" && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-white font-bold text-base">الخطوة الأولى: تثبيت الملف</h2>
              <p className="text-white/40 text-xs mt-0.5">
                نحتاج التعرف على جهازك — حمّل الملف وثبّته ثم عُد هنا
              </p>
            </div>

            <div className="p-5 space-y-5">
              <div className="space-y-3">
                {[
                  { num: "١", text: "اضغط «تحميل الملف» أدناه" },
                  { num: "٢", text: "افتح الإعدادات ← الملف الذي تم تحميله ← ثبّت" },
                  { num: "٣", text: "عُد لهذه الصفحة — ستظهر بياناتك تلقائياً" },
                ].map(s => (
                  <div key={s.num} className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: `${A}20`, color: A }}
                    >
                      {s.num}
                    </div>
                    <p className="text-white/70 text-sm pt-1">{s.text}</p>
                  </div>
                ))}
              </div>

              <a
                href={profileUrl}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: A, color: "#000" }}
              >
                <Download className="w-4 h-4" />
                تحميل الملف
              </a>

              <div className="flex items-center justify-center gap-2 text-white/25 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>في انتظار التثبيت{pollCount > 0 ? ` (${pollCount})` : ""}...</span>
              </div>

              <div className="flex items-start gap-2 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                <Shield className="w-4 h-4 shrink-0 mt-0.5" style={{ color: `${A}80` }} />
                <p className="text-white/30 text-xs leading-relaxed">
                  الملف آمن ومعتمد من <span style={{ color: A }}>app.mismari.com</span> — يُستخدم فقط للتعرف على جهازك ولا يُثبَّت أي محتوى
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Checking ── */}
        {step === "checking" && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-white/40" />
            <p className="text-white/40 text-sm">جارٍ التحقق من جهازك...</p>
          </div>
        )}

        {/* ── Already subscribed ── */}
        {step === "already-subscribed" && checkResult?.subscriber && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 text-center space-y-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "#34C75920", border: "1px solid #34C75940" }}
            >
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg mb-1">جهازك مشترك بالفعل!</h2>
              {checkResult.subscriber.subscriberName && (
                <p className="text-white/60 text-sm">مرحباً، {checkResult.subscriber.subscriberName}</p>
              )}
            </div>
            <div className="bg-black/40 rounded-xl p-3 text-right space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">الكود</span>
                <span className="font-mono text-xs" style={{ color: A }}>{checkResult.subscriber.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">الحالة</span>
                <span className={checkResult.subscriber.isActive === "true" ? "text-green-400" : "text-red-400"}>
                  {checkResult.subscriber.isActive === "true" ? "نشط" : "غير نشط"}
                </span>
              </div>
              {checkResult.subscriber.expiresAt && (
                <div className="flex justify-between">
                  <span className="text-white/40">ينتهي في</span>
                  <span className="text-white/70">{new Date(checkResult.subscriber.expiresAt).toLocaleDateString("ar-SA")}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate(`/subscriber/${checkResult.subscriber!.code}`)}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: `${A}20`, color: A, border: `1px solid ${A}30` }}
            >
              عرض ملف الاشتراك
            </button>
          </div>
        )}

        {/* ── Form ── */}
        {(step === "form" || step === "submitting") && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2 mb-0.5">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <h2 className="text-white font-bold text-base">تم التعرف على جهازك</h2>
              </div>
              <p className="text-white/40 text-xs mt-0.5">أكمل بياناتك وسيتواصل معك فريقنا</p>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {udid && (
                <div className="bg-black/30 rounded-xl p-3">
                  <p className="text-white/30 text-xs mb-1">معرّف الجهاز (UDID)</p>
                  <p className="font-mono text-xs text-white/50 break-all">{udid}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">الاسم الكامل *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className={inp + " text-right"}
                  style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif" }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">رقم الهاتف *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                  className={inp + " text-left font-mono"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  dir="ltr"
                  className={inp + " text-left"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">نوع الجهاز</label>
                <div className="flex gap-2">
                  {["iPhone", "iPad", "Mac"].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDeviceType(type)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border"
                      style={deviceType === type
                        ? { background: `${A}20`, color: A, borderColor: `${A}40` }
                        : { background: "transparent", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.08)" }
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {plans.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    الباقة المطلوبة
                  </label>
                  <div className="space-y-2">
                    {plans.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlanId(p.id === planId ? "" : p.id)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border text-right transition-all"
                        style={planId === p.id
                          ? { background: `${A}15`, borderColor: `${A}40` }
                          : { background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }
                        }
                      >
                        <p className="text-sm font-medium" style={{ color: planId === p.id ? A : "rgba(255,255,255,0.8)" }}>
                          {p.nameAr || p.name}
                        </p>
                        {p.price != null && (
                          <span className="text-sm font-bold" style={{ color: planId === p.id ? A : "rgba(255,255,255,0.4)" }}>
                            {p.price === 0 ? "مجاني" : `${p.price} ${p.currency || ""}`}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">ملاحظات (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="أي معلومات إضافية..."
                  rows={3}
                  className={inp + " text-right resize-none"}
                  style={{ fontFamily: "IBM Plex Sans Arabic, sans-serif" }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={step === "submitting"}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: A, color: "#000" }}
              >
                {step === "submitting"
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />}
                {step === "submitting" ? "جارٍ الإرسال..." : "إرسال الطلب"}
              </button>
            </form>
          </div>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 text-center space-y-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "#34C75920", border: "1px solid #34C75940" }}
            >
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl mb-2">تم إرسال طلبك!</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                سيتواصل معك فريقنا في أقرب وقت ممكن لتفعيل اشتراكك.
              </p>
            </div>
            {udid && (
              <div className="bg-black/30 rounded-xl p-3 text-right text-sm space-y-1">
                <p className="text-white/30 text-xs">معرّف جهازك المسجل</p>
                <p className="font-mono text-xs text-white/40 break-all">{udid}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Error ── */}
        {step === "error" && (
          <div className="bg-[#0a0a0a] border border-red-500/20 rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h2 className="text-white font-bold text-xl mb-2">حدث خطأ</h2>
              <p className="text-white/50 text-sm">تعذّر إرسال طلبك، يرجى المحاولة مرة أخرى.</p>
            </div>
            <button
              onClick={() => setStep("form")}
              className="flex items-center gap-2 mx-auto text-sm text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
