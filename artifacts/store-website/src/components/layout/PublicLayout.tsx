import { Link } from "wouter";
import { ShoppingBag, Search, Menu, X, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="fixed top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-accent/10 blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 glass-panel bg-background/40">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-2xl tracking-tight text-gradient">متجر بلس</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">الرئيسية</Link>
              <a href="#apps" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">التطبيقات</a>
              <a href="#plans" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">الاشتراكات</a>
              <a href="#faq" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">الأسئلة الشائعة</a>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button className="w-10 h-10 rounded-full glass-button flex items-center justify-center text-foreground/80 hover:text-primary">
              <Search className="w-5 h-5" />
            </button>
            <Link href="/admin/login" className="px-5 py-2.5 rounded-full text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300">
              لوحة التحكم
            </Link>
            <a href="#plans" className="px-6 py-2.5 rounded-full text-sm font-bold bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300">
              اشترك الآن
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-foreground/80"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-20 z-40 glass-panel border-t-0 p-4 md:hidden flex flex-col gap-4"
          >
            <Link href="/" className="p-3 rounded-xl hover:bg-white/5 font-medium">الرئيسية</Link>
            <a href="#apps" onClick={() => setIsMobileMenuOpen(false)} className="p-3 rounded-xl hover:bg-white/5 font-medium">التطبيقات</a>
            <a href="#plans" onClick={() => setIsMobileMenuOpen(false)} className="p-3 rounded-xl hover:bg-white/5 font-medium">الاشتراكات</a>
            <Link href="/admin/login" className="p-3 rounded-xl hover:bg-white/5 font-medium text-primary">لوحة التحكم</Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col items-center">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-black/20 mt-20 pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-xl">متجر بلس</span>
              </Link>
              <p className="text-muted-foreground leading-relaxed max-w-sm">
                المنصة الأولى والآمنة لتحميل تطبيقات بلس والألعاب المهكرة والبرامج المدفوعة لأجهزة الآيفون والآيباد بدون جلبريك.
              </p>
              <div className="flex items-center gap-2 mt-6 text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full w-fit border border-emerald-400/20">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-sm font-medium">آمن وموثوق 100%</span>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6">روابط سريعة</h4>
              <ul className="space-y-4">
                <li><a href="#apps" className="text-muted-foreground hover:text-primary transition-colors">تطبيقات بلس</a></li>
                <li><a href="#apps" className="text-muted-foreground hover:text-primary transition-colors">ألعاب مهكرة</a></li>
                <li><a href="#plans" className="text-muted-foreground hover:text-primary transition-colors">الباقات والأسعار</a></li>
                <li><a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">كيفية التفعيل</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-6">الدعم والمساعدة</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">الشروط والأحكام</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">سياسة الخصوصية</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">سياسة الاسترجاع</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary transition-colors">تواصل معنا</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              © {new Date().getFullYear()} متجر بلس. جميع الحقوق محفوظة.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>صنع بحب للمستخدم العربي</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
