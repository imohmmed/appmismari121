import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRIMARY = "#9fbcff";
const TEXT = "#2b283b";
const API = import.meta.env.VITE_API_URL || "";

interface SocialSettings {
  instagram: string;
  telegram: string;
  whatsapp: string;
}

function usePublicSettings() {
  const [social, setSocial] = useState<SocialSettings>({ instagram: "", telegram: "", whatsapp: "" });
  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(d => setSocial({
        instagram: d.support_instagram || d.instagram || "",
        telegram:  d.support_telegram  || d.telegram  || "",
        whatsapp:  d.support_whatsapp  || d.whatsapp  || "",
      }))
      .catch(() => {});
  }, []);
  return social;
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TelegramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function SocialIcon({ href, children, color }: { href: string; children: React.ReactNode; color: string }) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
      style={{ background: `${color}20`, color }}
    >
      {children}
    </a>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const social = usePublicSettings();

  const navItems = [
    { label: "تطبيقاتنا", href: "#apps" },
    { label: "الاشتراكات", href: "#plans" },
    { label: "الأسئلة الشائعة", href: "#faq" },
    { label: "تفعيل الاشتراك", href: "#activate" },
    { label: "طلب اشتراك", href: "#plans" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#ffffff", color: TEXT, direction: "rtl", maxWidth: "100vw", overflowX: "clip" }}>

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-black/8 shadow-sm">
        <div className="flex items-center justify-between px-5 py-2 max-w-5xl mx-auto" style={{ minHeight: "52px" }}>
          <a href="/" className="flex items-center flex-shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}mismari-logo.png`}
              alt="مسماري"
              style={{ height: "38px", width: "auto", objectFit: "contain", flexShrink: 0 }}
            />
          </a>

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

                {(social.whatsapp || social.telegram || social.instagram) && (
                  <>
                    <div className="mx-4 my-2 border-t border-black/8" />
                    <p className="px-4 py-1 text-xs font-semibold" style={{ color: `${TEXT}55` }}>تواصل معنا</p>
                    <div className="flex items-center gap-3 px-4 pb-2">
                      {social.whatsapp && (
                        <a href={social.whatsapp.startsWith("http") ? social.whatsapp : `https://${social.whatsapp}`}
                          target="_blank" rel="noopener noreferrer"
                          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                          style={{ background: "#25D36620", color: "#25D366" }}>
                          <WhatsAppIcon size={18} />
                        </a>
                      )}
                      {social.telegram && (
                        <a href={social.telegram.startsWith("http") ? social.telegram : `https://${social.telegram}`}
                          target="_blank" rel="noopener noreferrer"
                          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                          style={{ background: "#0088CC20", color: "#0088CC" }}>
                          <TelegramIcon size={18} />
                        </a>
                      )}
                      {social.instagram && (
                        <a href={social.instagram.startsWith("http") ? social.instagram : `https://${social.instagram}`}
                          target="_blank" rel="noopener noreferrer"
                          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                          style={{ background: "#E1306C20", color: "#E1306C" }}>
                          <InstagramIcon size={18} />
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>

      <footer className="border-t border-black/8 py-10 px-5 text-center" style={{ background: `${PRIMARY}08` }}>
        <a href="/" className="inline-flex items-center justify-center mb-4">
          <img
            src={`${import.meta.env.BASE_URL}mismari-logo.png`}
            alt="مسماري"
            style={{ maxHeight: "56px", width: "auto", objectFit: "contain" }}
          />
        </a>
        <div className="flex flex-wrap justify-center gap-6 mb-5 text-sm" style={{ color: `${TEXT}88` }}>
          <a href="#apps" className="hover:underline">تطبيقاتنا</a>
          <a href="#plans" className="hover:underline">الاشتراكات</a>
          <a href="#faq" className="hover:underline">الأسئلة الشائعة</a>
        </div>

        {(social.instagram || social.telegram || social.whatsapp) && (
          <div className="flex items-center justify-center gap-3 mb-5">
            <SocialIcon href={social.whatsapp} color="#25D366">
              <WhatsAppIcon size={18} />
            </SocialIcon>
            <SocialIcon href={social.telegram} color="#0088CC">
              <TelegramIcon size={18} />
            </SocialIcon>
            <SocialIcon href={social.instagram} color="#E1306C">
              <InstagramIcon size={18} />
            </SocialIcon>
          </div>
        )}

        <p className="text-xs" style={{ color: `${TEXT}55` }}>
          © {new Date().getFullYear()} مسماري — جميع الحقوق محفوظة
        </p>
      </footer>
    </div>
  );
}
