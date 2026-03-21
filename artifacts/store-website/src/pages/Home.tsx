import { useListPlans } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X, Shield, Smartphone, Zap } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";

const PRIMARY = "#9fbcff";
const TEXT = "#2b283b";
const API = import.meta.env.VITE_API_URL || "";

interface AppItem {
  id: number;
  name: string;
  icon?: string;
  iconUrl?: string;
  description?: string;
  version?: string;
  size?: string;
}

function useAppsSection(section: string, limit = 14) {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/apps?section=${section}&limit=${limit}`)
      .then(r => r.json())
      .then(r => setApps(Array.isArray(r) ? r : r.apps ?? []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, [section, limit]);
  return { apps, loading };
}

function AppPopup({ app, onClose }: { app: AppItem; onClose: () => void }) {
  const icon = app.iconUrl || app.icon;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: "#ffffff" }}
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: `${TEXT}15` }}
          >
            <X className="w-4 h-4" style={{ color: TEXT }} />
          </button>

          <div className="flex flex-col items-center pt-8 px-6 pb-6" dir="rtl">
            <div
              className="w-24 h-24 rounded-[22px] overflow-hidden border border-black/8 shadow-md mb-4 bg-gray-50 flex items-center justify-center"
            >
              {icon
                ? <img src={icon} alt={app.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                : <span className="text-4xl">📱</span>
              }
            </div>

            <h2 className="text-xl font-black mb-1 text-center" style={{ color: TEXT }}>{app.name}</h2>

            {(app.version || app.size) && (
              <div className="flex items-center gap-3 mb-4">
                {app.version && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${PRIMARY}20`, color: PRIMARY }}>
                    v{app.version}
                  </span>
                )}
                {app.size && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${TEXT}10`, color: `${TEXT}80` }}>
                    {app.size}
                  </span>
                )}
              </div>
            )}

            {app.description && (
              <p className="text-sm text-center leading-relaxed" style={{ color: `${TEXT}80` }}>
                {app.description}
              </p>
            )}

            {!app.description && !app.version && !app.size && (
              <p className="text-sm text-center" style={{ color: `${TEXT}50` }}>تطبيق مميز ضمن متجر مسماري</p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AppCard({ app, onClick }: { app: AppItem; onClick: () => void }) {
  const icon = app.iconUrl || app.icon;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 min-w-[80px] cursor-pointer group text-right"
    >
      <div className="w-16 h-16 rounded-2xl overflow-hidden border border-black/8 shadow-sm bg-gray-100 flex items-center justify-center group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
        {icon
          ? <img src={icon} alt={app.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : <span className="text-2xl">📱</span>
        }
      </div>
      <span className="text-center text-[11px] font-medium leading-tight max-w-[72px] truncate" style={{ color: TEXT }}>
        {app.name}
      </span>
    </button>
  );
}

function AppsRow({ title, section, onAppClick }: { title: string; section: string; onAppClick: (app: AppItem) => void }) {
  const { apps, loading } = useAppsSection(section);

  if (!loading && apps.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="px-5 mb-4">
        <h3 className="text-base font-black" style={{ color: TEXT }}>{title}</h3>
      </div>
      <div className="flex overflow-x-auto gap-4 px-5 pb-2 hide-scrollbar snap-x snap-mandatory">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[80px]">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 animate-pulse" />
                <div className="w-12 h-2 rounded bg-gray-100 animate-pulse" />
              </div>
            ))
          : apps.map(app => <AppCard key={app.id} app={app} onClick={() => onAppClick(app)} />)
        }
      </div>
    </div>
  );
}

const faqs = [
  { q: "كيف أبدأ الاشتراك؟", a: "اضغط على 'طلب اشتراك' وسيتم التعرف على جهازك تلقائياً، ثم أدخل معلوماتك وسنتواصل معك لإتمام الاشتراك." },
  { q: "هل التطبيقات آمنة؟", a: "نعم، كل تطبيق يُفحص قبل نشره لضمان سلامة جهازك." },
  { q: "ما هي الأجهزة المدعومة؟", a: "يدعم المتجر أجهزة iPhone وiPad فقط." },
  { q: "كيف أفعّل اشتراكي؟", a: "إذا كان لديك اشتراك، اضغط 'تفعيل الاشتراك' وسيتم التحقق تلقائياً وعرض تفاصيل اشتراكك." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="py-4 border-b last:border-b-0 cursor-pointer"
      style={{ borderColor: `${TEXT}10` }}
      onClick={() => setOpen(v => !v)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-sm" style={{ color: TEXT }}>{q}</span>
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform duration-200"
          style={{ color: `${TEXT}60`, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-sm mt-3 leading-relaxed" style={{ color: `${TEXT}80` }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FEATURES = [
  { icon: Shield, label: "آمن 100%" },
  { icon: Smartphone, label: "بدون جلبريك" },
  { icon: Zap, label: "iPhone & iPad" },
];

export default function Home() {
  const { data: plansData, isLoading: plansLoading } = useListPlans();
  const plans = plansData?.plans || [];
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);

  return (
    <PublicLayout>

      {/* ───── HERO ───── */}
      <section
        id="hero"
        className="flex flex-col items-center justify-center text-center px-5 py-20"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${PRIMARY}22 0%, transparent 70%)` }}
      >
        <img
          src={`${import.meta.env.BASE_URL}mismari-logo-nobg.png`}
          alt="مسماري"
          className="mb-6"
          style={{
            width: "110px",
            height: "140px",
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.10))",
          }}
        />
        <p className="text-sm font-semibold mb-6" style={{ color: PRIMARY }}>
          متجر التطبيقات المميز
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <a
            href="#plans"
            className="inline-flex items-center justify-center gap-2 font-bold text-sm px-7 py-3.5 rounded-full text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, #6fa8ff)` }}
          >
            طلب اشتراك
          </a>
          <a
            href="#activate"
            className="inline-flex items-center justify-center gap-2 font-bold text-sm px-7 py-3.5 rounded-full border transition-all hover:-translate-y-0.5"
            style={{ color: TEXT, borderColor: `${TEXT}30`, background: `${TEXT}08` }}
          >
            تفعيل الاشتراك
          </a>
        </div>

        {/* 3 Quick Features */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: `${PRIMARY}15`, color: PRIMARY }}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </div>
          ))}
        </div>
      </section>

      {/* ───── APPS ───── */}
      <section id="apps" className="py-14 w-full max-w-5xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8 px-5" style={{ color: TEXT }}>
          تطبيقاتنا
        </h2>
        <AppsRow title="الأكثر تحميلاً" section="most_downloaded" onAppClick={setSelectedApp} />
        <AppsRow title="الأكثر رواجاً" section="trending" onAppClick={setSelectedApp} />
        <AppsRow title="أحدث الإضافات" section="latest" onAppClick={setSelectedApp} />
      </section>

      {/* ───── ACTIVATE ───── */}
      <section id="activate" className="py-14 px-5 w-full max-w-xl mx-auto text-center">
        <h2 className="text-2xl font-black mb-2" style={{ color: TEXT }}>تفعيل الاشتراك</h2>
        <p className="text-sm mb-8" style={{ color: `${TEXT}80` }}>أدخل كود الاشتراك الخاص بك لتفعيل اشتراكك</p>
        <div className="rounded-2xl border p-6" style={{ borderColor: `${TEXT}15`, background: `${PRIMARY}06` }}>
          <input
            type="text"
            placeholder="أدخل كود الاشتراك..."
            className="w-full rounded-xl border px-4 py-3.5 text-sm mb-4 text-center focus:outline-none"
            style={{ borderColor: `${TEXT}20`, background: "#fff", color: TEXT }}
            dir="ltr"
          />
          <button
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, #6fa8ff)`, color: "#fff" }}
          >
            تحقق من الاشتراك
          </button>
        </div>
      </section>

      {/* ───── PLANS ───── */}
      <section id="plans" className="py-14 px-5 w-full">
        <h2 className="text-2xl font-black text-center mb-2" style={{ color: TEXT }}>
          الاشتراكات
        </h2>
        <p className="text-center text-sm mb-10" style={{ color: `${TEXT}88` }}>
          اختر الباقة المناسبة لك
        </p>

        {plansLoading ? (
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="h-72 rounded-3xl animate-pulse bg-gray-100" />
            <div className="h-72 rounded-3xl animate-pulse bg-gray-100" />
          </div>
        ) : plans.length === 0 ? (
          <div className="max-w-sm mx-auto rounded-3xl p-7 text-center shadow-xl border relative" style={{ background: TEXT, borderColor: `${PRIMARY}20` }}>
            <div className="text-xs font-bold mb-4 mt-1" style={{ color: PRIMARY }}>
              الباقة الأساسية
            </div>
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-4xl font-black text-white" style={{ fontFamily: "Outfit, sans-serif" }}>—</span>
            </div>
            <p className="text-sm mb-6" style={{ color: `${PRIMARY}aa` }}>اتصل بنا للأسعار</p>
            <div className="flex flex-col gap-2.5 mb-6 text-right">
              {["وصول كامل للتطبيقات", "تحديثات مستمرة", "دعم فني سريع", "جهاز واحد"].map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${PRIMARY}25` }}>
                    <span className="text-xs" style={{ color: PRIMARY }}>✓</span>
                  </div>
                  <span className="text-sm text-white/80">{f}</span>
                </div>
              ))}
            </div>
            <a href="#" className="block w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90" style={{ background: PRIMARY, color: TEXT }}>
              طلب اشتراك
            </a>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
            {plans.map((plan) => {
              const features = plan.features || [];
              const excluded = plan.excludedFeatures || [];
              return (
                <div
                  key={plan.id}
                  className="rounded-3xl p-7 text-center shadow-xl border relative"
                  style={{ background: TEXT, borderColor: plan.isPopular ? `${PRIMARY}60` : `${PRIMARY}20` }}
                >
                  {plan.isPopular && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                      style={{ background: PRIMARY, color: TEXT }}
                    >
                      ✦ الأكثر طلباً
                    </div>
                  )}
                  <div className="text-xs font-bold mb-4 mt-1" style={{ color: PRIMARY }}>
                    {plan.nameAr || plan.name}
                  </div>
                  <div className="flex items-end justify-center gap-1 mb-1">
                    <span className="text-4xl font-black text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
                      {plan.price?.toLocaleString("ar-IQ")}
                    </span>
                  </div>
                  <p className="text-sm mb-6" style={{ color: `${PRIMARY}aa` }}>
                    {plan.currency === "IQD" ? "دينار عراقي" : plan.currency}
                  </p>
                  <div className="flex flex-col gap-2.5 mb-6 text-right">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${PRIMARY}25` }}>
                          <span className="text-xs" style={{ color: PRIMARY }}>✓</span>
                        </div>
                        <span className="text-sm text-white/80">{f}</span>
                      </div>
                    ))}
                    {excluded.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 opacity-40">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-red-500/20">
                          <span className="text-xs text-red-400">✕</span>
                        </div>
                        <span className="text-sm text-white/50 line-through">{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="block w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
                    style={{ background: PRIMARY, color: TEXT }}
                  >
                    طلب اشتراك
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───── FAQ ───── */}
      <section id="faq" className="py-14 px-5 w-full max-w-2xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8" style={{ color: TEXT }}>
          الأسئلة الشائعة
        </h2>
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${TEXT}15` }}>
          <div className="px-6">
            {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ───── APP POPUP ───── */}
      {selectedApp && (
        <AppPopup app={selectedApp} onClose={() => setSelectedApp(null)} />
      )}

    </PublicLayout>
  );
}
