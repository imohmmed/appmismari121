import { useListPlans } from "@workspace/api-client-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X, Shield, Smartphone, Zap } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Link } from "react-router-dom";

const PRIMARY = "#9fbcff";
const TEXT = "#2b283b";
const API = import.meta.env.VITE_API_URL || "";
const BASE = import.meta.env.BASE_URL || "/";

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
      <div className="flex overflow-x-auto gap-4 px-5 pb-2 hide-scrollbar">
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

// ─── Products Section ──────────────────────────────────────────────────────
interface ProductItem {
  id: number;
  name: string;
  price?: number;
  currency?: string;
  imageList?: string[];
}

function useProducts() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/api/products`)
      .then(r => r.json())
      .then(r => setProducts(Array.isArray(r) ? r : r.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);
  return { products, loading };
}

function ProductCard({ product }: { product: ProductItem }) {
  const thumb = product.imageList?.[0] || null;
  return (
    <Link
      to={`/products/${product.id}`}
      className="flex flex-col rounded-2xl overflow-hidden border transition-all hover:shadow-md hover:-translate-y-0.5 duration-200"
      style={{ borderColor: `${TEXT}12`, background: "#fff" }}
    >
      <div className="w-full bg-gray-100 flex items-center justify-center overflow-hidden" style={{ aspectRatio: "4/5" }}>
        {thumb
          ? <img src={thumb} alt={product.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : <span className="text-5xl">🛍️</span>
        }
      </div>
      <div className="p-3 flex flex-col gap-1">
        <span className="font-bold text-sm leading-tight line-clamp-2" style={{ color: TEXT }}>{product.name}</span>
        {product.price != null && (
          <span className="text-xs font-semibold" style={{ color: PRIMARY }}>
            {product.price.toLocaleString("ar-IQ")} {product.currency === "IQD" ? "د.ع" : product.currency || ""}
          </span>
        )}
      </div>
    </Link>
  );
}

function ProductsSection() {
  const { products, loading } = useProducts();
  if (!loading && products.length === 0) return null;
  return (
    <section id="products" className="py-14 w-full max-w-5xl mx-auto px-5">
      <h2 className="text-2xl font-black text-center mb-8" style={{ color: TEXT }}>منتجاتنا</h2>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden">
              <div className="w-full bg-gray-100 animate-pulse" style={{ aspectRatio: "4/5" }} />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-2 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
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

// ─── helpers ──────────────────────────────────────────────────────────────────
let enrollPollingInterval: ReturnType<typeof setInterval> | null = null;

function goToEnroll(planName?: string) {
  const token = sessionStorage.getItem("enroll_token") || crypto.randomUUID().replace(/-/g, "").substring(0, 20);
  sessionStorage.setItem("enroll_token", token);
  if (planName) sessionStorage.setItem("enroll_plan", planName);

  const planParam = planName ? `&plan=${encodeURIComponent(planName)}` : "";
  const profileUrl = `${API}/api/profile/enroll?source=web&token=${encodeURIComponent(token)}${planParam}`;

  const a = document.createElement("a");
  a.href = profileUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (enrollPollingInterval) clearInterval(enrollPollingInterval);
  enrollPollingInterval = setInterval(async () => {
    try {
      const r = await fetch(`${API}/api/profile/udid-check?token=${token}`, { cache: "no-store" });
      const d = await r.json();
      if (d.found && d.udid) {
        if (enrollPollingInterval) clearInterval(enrollPollingInterval);
        enrollPollingInterval = null;
        sessionStorage.setItem("enroll_udid", d.udid);
        const params = new URLSearchParams();
        params.set("udid", d.udid);
        if (planName) params.set("plan", planName);
        window.location.href = `${BASE}enroll?${params.toString()}`;
      }
    } catch {}
  }, 2000);
}

interface ActivateResult {
  valid: boolean;
  alreadyRegistered?: boolean;
  planName?: string;
  groupName?: string;
  downloadLink?: string;
  hasIpa?: boolean;
  error?: string;
}

export default function Home() {
  const { data: plansData, isLoading: plansLoading } = useListPlans();
  const plans = plansData?.plans || [];
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);

  // ── Code activation state ──
  const [code, setCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [activateResult, setActivateResult] = useState<ActivateResult | null>(null);

  const activatePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (activatePollingRef.current) clearInterval(activatePollingRef.current); };
  }, []);

  async function handleActivate() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setActivating(true);
    setActivateResult(null);
    try {
      const res = await fetch(`${API}/api/activate/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data: ActivateResult = await res.json();
      if (data.valid) {
        if (data.alreadyRegistered) {
          window.location.href = `${BASE}activate?code=${encodeURIComponent(trimmed)}`;
          return;
        }

        const token = sessionStorage.getItem("activate_token") || crypto.randomUUID().replace(/-/g, "").substring(0, 20);
        sessionStorage.setItem("activate_token", token);

        const profileUrl = `${API}/api/profile/enroll?source=activate&token=${encodeURIComponent(token)}`;
        const a = document.createElement("a");
        a.href = profileUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (activatePollingRef.current) clearInterval(activatePollingRef.current);
        activatePollingRef.current = setInterval(async () => {
          try {
            const r = await fetch(`${API}/api/profile/udid-check?token=${token}`, { cache: "no-store" });
            const d = await r.json();
            if (d.found && d.udid) {
              if (activatePollingRef.current) clearInterval(activatePollingRef.current);
              activatePollingRef.current = null;
              sessionStorage.setItem("activate_udid", d.udid);
              window.location.href = `${BASE}activate?code=${encodeURIComponent(trimmed)}&udid=${encodeURIComponent(d.udid)}`;
            }
          } catch {}
        }, 2000);

        setActivateResult({ valid: true });
        setActivating(false);
        return;
      }
      setActivateResult(data);
    } catch {
      setActivateResult({ valid: false, error: "تعذّر الاتصال بالخادم" });
    } finally {
      setActivating(false);
    }
  }

  return (
    <PublicLayout>

      {/* ───── HERO ───── */}
      <section
        id="hero"
        className="flex flex-col items-center justify-center text-center px-5 py-8"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${PRIMARY}22 0%, transparent 70%)` }}
      >
        <img
          src={`${import.meta.env.BASE_URL}mismari-logo.png`}
          alt="مسماري"
          className="mb-3"
          style={{
            maxWidth: "200px",
            height: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.10))",
          }}
        />
        <p className="text-sm font-semibold mb-4" style={{ color: PRIMARY }}>
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

      {/* ───── PRODUCTS ───── */}
      <ProductsSection />

      {/* ───── ACTIVATE ───── */}
      <section id="activate" className="py-14 px-5 w-full max-w-xl mx-auto text-center">
        <h2 className="text-2xl font-black mb-2" style={{ color: TEXT }}>تفعيل الاشتراك</h2>
        <p className="text-sm mb-8" style={{ color: `${TEXT}80` }}>أدخل كود الاشتراك الخاص بك لتفعيل اشتراكك</p>
        <div className="rounded-2xl border p-6" style={{ borderColor: `${TEXT}15`, background: `${PRIMARY}06` }}>
          <input
            type="text"
            placeholder="أدخل كود الاشتراك..."
            className="w-full rounded-xl border px-4 py-3.5 text-sm mb-4 text-center focus:outline-none tracking-widest uppercase"
            style={{ borderColor: `${TEXT}20`, background: "#fff", color: TEXT }}
            dir="ltr"
            value={code}
            onChange={e => { setCode(e.target.value); setActivateResult(null); }}
            onKeyDown={e => e.key === "Enter" && handleActivate()}
          />
          <button
            onClick={handleActivate}
            disabled={activating || !code.trim()}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, #6fa8ff)`, color: "#fff" }}
          >
            {activating ? "جاري التحقق..." : "تحقق من الاشتراك"}
          </button>

          {/* Result */}
          {activateResult && (
            <div
              className="mt-4 rounded-xl p-4 text-sm text-right"
              style={{
                background: activateResult.valid ? `${PRIMARY}15` : "#ff4d4d15",
                border: `1px solid ${activateResult.valid ? PRIMARY : "#ff4d4d"}40`,
              }}
            >
              {!activateResult.valid ? (
                <p style={{ color: "#e53e3e" }}>{activateResult.error || "الكود غير صحيح أو منتهي الصلاحية"}</p>
              ) : (
                <div className="flex flex-col gap-2 items-center text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${PRIMARY}25` }}>
                    <Shield className="w-5 h-5" style={{ color: PRIMARY }} />
                  </div>
                  <p className="font-bold" style={{ color: PRIMARY }}>تم تحميل ملف التعريف</p>
                  <p className="text-xs" style={{ color: `${TEXT}80` }}>
                    ثبّت الملف من الإعدادات → عام → VPN وإدارة الأجهزة
                  </p>
                  <p className="text-xs" style={{ color: `${TEXT}60` }}>
                    سيتم نقلك تلقائياً بعد التثبيت لإكمال التفعيل
                  </p>
                </div>
              )}
            </div>
          )}
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
            <button onClick={() => goToEnroll()} className="block w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90" style={{ background: PRIMARY, color: TEXT }}>
              طلب اشتراك
            </button>
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
                    onClick={() => goToEnroll(plan.nameAr || plan.name)}
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
