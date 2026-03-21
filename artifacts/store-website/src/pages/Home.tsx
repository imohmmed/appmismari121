import { PublicLayout } from "@/components/layout/PublicLayout";
import { useListApps, useListFeaturedApps, useListHotApps, useListPlans } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Star, Flame, Sparkles, CheckCircle2, AlertCircle, ChevronDown, Smartphone, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";

function AppCard({ app, index }: { app: any, index: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="shrink-0 w-[140px] snap-start flex flex-col items-center gap-3 group cursor-pointer"
    >
      <div className="relative w-28 h-28 rounded-[2rem] overflow-hidden bg-card border border-border shadow-md group-hover:shadow-lg group-hover:shadow-primary/10 transition-all duration-300 group-hover:-translate-y-1">
        <img 
          src={app.icon || `https://ui-avatars.com/api/?name=${app.name}&background=random`} 
          alt={app.name} 
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${app.name}&background=random` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
          <span className="text-xs font-bold bg-primary px-3 py-1 rounded-full text-white shadow-lg">تحميل</span>
        </div>
      </div>
      <div className="text-center w-full">
        <h4 className="font-bold text-sm truncate px-1 text-foreground group-hover:text-primary transition-colors">{app.name}</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">{app.categoryName || "تطبيقات"}</p>
      </div>
    </motion.div>
  );
}

function AppSection({ title, icon: Icon, apps, loading }: { title: string, icon: any, apps: any[], loading: boolean }) {
  if (loading) return <div className="h-48 w-full animate-pulse bg-card rounded-3xl mb-12"></div>;
  if (!apps || apps.length === 0) return null;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        </div>
        <button className="text-sm font-medium text-primary hover:text-primary/70 transition-colors flex items-center gap-1">
          عرض الكل
        </button>
      </div>

      <div className="flex overflow-x-auto gap-6 pb-6 pt-2 snap-x snap-mandatory hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {apps.map((app, i) => (
          <AppCard key={app.id} app={app} index={i} />
        ))}
      </div>
    </div>
  );
}

const faqs = [
  { q: "كيف أبدأ الاشتراك؟", a: "يمكنك البدء باختيار الباقة المناسبة لك من قسم الاشتراكات، ثم الضغط على طلب اشتراك واتباع التعليمات البسيطة للدفع وتفعيل حسابك فوراً." },
  { q: "هل التطبيقات آمنة؟", a: "نعم، جميع التطبيقات مفحوصة وآمنة 100% ولا تتطلب جلبريك. نحن نستخدم شهادات مطورين رسمية لضمان استقرار التطبيقات على جهازك." },
  { q: "ما هي الأجهزة المدعومة؟", a: "ندعم جميع أجهزة الآيفون (iPhone) والآيباد (iPad) التي تعمل بنظام iOS 14 وما فوق." },
  { q: "كيف أفعّل اشتراكي؟", a: "بعد الدفع، ستحصل على كود تفعيل. يمكنك إدخاله في صفحة التفعيل مع رقم جهازك (UDID) وسيتم تفعيل اشتراكك وتتمكن من تحميل متجرنا." }
];

export default function Home() {
  const { data: featuredAppsData, isLoading: featuredLoading } = useListFeaturedApps();
  const { data: hotAppsData, isLoading: hotLoading } = useListHotApps();
  const { data: newAppsData, isLoading: newLoading } = useListApps({ filter: "new", limit: 10 });
  const { data: plansData, isLoading: plansLoading } = useListPlans();

  const featuredApps = featuredAppsData?.apps || [];
  const hotApps = hotAppsData?.apps || [];
  const newApps = newAppsData?.apps || [];
  const plans = plansData?.plans || [];

  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  return (
    <PublicLayout>
      <section className="w-full min-h-[85vh] flex flex-col items-center justify-center relative px-4 text-center mt-[-80px] pt-[80px]">
        <div className="absolute inset-0 -z-10">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Background" 
            className="w-full h-full object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-24 h-24 md:w-32 md:h-32 mb-8 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-primary/20 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-primary to-secondary opacity-30 animate-pulse" />
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Plus Store Logo" className="w-full h-full object-cover relative z-10 p-2" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 text-foreground">
            متجر التطبيقات <span className="text-primary">المميز</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            المنصة الأفضل لتحميل تطبيقات بلس، الألعاب المهكرة، وتطبيقات الأفلام بدون جلبريك.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#plans" className="w-full sm:w-auto px-8 py-4 rounded-full text-lg font-bold bg-primary text-white shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              طلب اشتراك
            </a>
            <button className="w-full sm:w-auto px-8 py-4 rounded-full text-lg font-bold bg-card border border-border text-foreground hover:bg-muted transition-all duration-300 flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              تفعيل الاشتراك
            </button>
          </div>
        </motion.div>

        <div className="mt-20 flex flex-wrap justify-center gap-6 max-w-4xl">
          {[
            { icon: ShieldCheck, text: "ضمان تعويض" },
            { icon: Download, text: "تحديثات مستمرة" },
            { icon: Smartphone, text: "بدون جلبريك" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-card rounded-full px-5 py-2 border border-border">
              <f.icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="apps" className="w-full py-20 relative z-10">
        <AppSection title="الأكثر تحميلاً" icon={Download} apps={hotApps} loading={hotLoading} />
        <AppSection title="الأكثر رواجاً" icon={Flame} apps={featuredApps} loading={featuredLoading} />
        <AppSection title="أحدث الإضافات" icon={Star} apps={newApps} loading={newLoading} />
      </section>

      <section id="plans" className="w-full py-24 relative">
        <div className="absolute inset-0 bg-secondary/10 skew-y-[-3deg] transform origin-top-left -z-10" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-foreground">الاشتراكات</h2>
            <p className="text-xl text-muted-foreground">اختر الباقة المناسبة لك واستمتع بآلاف التطبيقات</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plansLoading ? (
              <>
                <div className="h-[500px] rounded-[3rem] animate-pulse bg-card" />
                <div className="h-[500px] rounded-[3rem] animate-pulse bg-card" />
              </>
            ) : plans.map((plan, i) => (
              <motion.div 
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className={`relative rounded-[3rem] p-8 md:p-10 transition-all duration-300 ${
                  plan.isPopular 
                    ? 'bg-gradient-to-b from-primary/10 to-card border-2 border-primary/30 shadow-2xl shadow-primary/10 scale-100 md:scale-105 z-10' 
                    : 'bg-card border border-border shadow-lg'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-5 inset-x-0 flex justify-center">
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-sm font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                      <Star className="w-4 h-4 fill-black" /> الأكثر طلباً
                    </span>
                  </div>
                )}
                
                <h3 className={`text-2xl font-bold mb-2 ${plan.isPopular ? 'text-primary' : 'text-foreground'}`}>
                  {plan.nameAr || plan.name}
                </h3>
                
                <div className="flex items-baseline gap-2 mb-8 mt-6">
                  <span className="text-5xl font-black text-foreground">{plan.price.toLocaleString()}</span>
                  <span className="text-muted-foreground">{plan.currency}</span>
                </div>

                <div className="space-y-4 mb-10">
                  {plan.features?.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </div>
                  ))}
                  {plan.excludedFeatures?.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3 opacity-40">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span className="line-through">{feature}</span>
                    </div>
                  ))}
                </div>

                <button className={`w-full py-4 rounded-2xl text-lg font-bold transition-all duration-300 ${
                  plan.isPopular 
                    ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20' 
                    : 'bg-muted hover:bg-border text-foreground'
                }`}>
                  طلب اشتراك
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="w-full py-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4 text-foreground">الأسئلة الشائعة</h2>
            <p className="text-muted-foreground">كل ما تحتاج معرفته عن خدمتنا</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div 
                key={i} 
                className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
              >
                <div className="p-6 flex items-center justify-between">
                  <h4 className="font-bold text-lg pr-4 text-foreground">{faq.q}</h4>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${activeFaq === i ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
                </div>
                <AnimatePresence>
                  {activeFaq === i && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-6 pb-6 text-muted-foreground leading-relaxed"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
