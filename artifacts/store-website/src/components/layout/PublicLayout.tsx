import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY = "#9fbcff";
const TEXT = "#2b283b";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { label: "تطبيقاتنا", href: "#apps" },
    { label: "الاشتراكات", href: "#plans" },
    { label: "تفعيل الاشتراك", href: "#activate" },
    { label: "طلب اشتراك", href: "#plans" },
  ];

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "#ffffff", color: TEXT, direction: "rtl" }}>

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-black/8 shadow-sm">
        <div className="flex items-center justify-between px-5 h-16 max-w-5xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img src={`${import.meta.env.BASE_URL}mismari-logo-nobg.png`} alt="مسماري" className="h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
              style={{ background: menuOpen ? `${PRIMARY}20` : "transparent" }}
              aria-label="القائمة"
            >
              {menuOpen
                ? <X className="w-5 h-5" style={{ color: TEXT }} />
                : <Menu className="w-5 h-5" style={{ color: TEXT }} />
              }
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="overflow-hidden border-t border-black/8"
              style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)" }}
            >
              <div className="max-w-5xl mx-auto px-5 py-4 flex flex-col gap-1">
                {navItems.map(item => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="py-3 px-4 rounded-xl text-sm font-semibold transition-all hover:bg-black/5 text-start"
                    style={{ color: TEXT }}
                  >
                    {item.label}
                  </a>
                ))}
                <div className="h-px bg-black/8 my-2" />
                <Link
                  href="/admin/login"
                  onClick={() => setMenuOpen(false)}
                  className="py-3 px-4 rounded-xl text-sm font-semibold transition-all hover:bg-black/5 text-start"
                  style={{ color: `${TEXT}88` }}
                >
                  لوحة التحكم
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>

      <footer className="border-t border-black/8 py-8 px-5 text-center" style={{ background: `${PRIMARY}08` }}>
        <Link href="/" className="inline-flex items-center justify-center mb-4">
          <img src={`${import.meta.env.BASE_URL}mismari-logo-nobg.png`} alt="مسماري" className="h-8 w-auto" />
        </Link>
        <div className="flex flex-wrap justify-center gap-6 mb-4 text-sm" style={{ color: `${TEXT}88` }}>
          <a href="#apps" className="hover:underline">تطبيقاتنا</a>
          <a href="#plans" className="hover:underline">الاشتراكات</a>
          <a href="#faq" className="hover:underline">الأسئلة الشائعة</a>
          <Link href="/admin/login" className="hover:underline">لوحة التحكم</Link>
        </div>
        <p className="text-xs" style={{ color: `${TEXT}55` }}>
          © {new Date().getFullYear()} مسماري — جميع الحقوق محفوظة
        </p>
      </footer>
    </div>
  );
}
