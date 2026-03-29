import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2, Download, AlertCircle, Smartphone, CheckCircle2 } from "lucide-react";
import { useLogoSrc } from "@/contexts/AppearanceContext";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

interface DownloadInfo {
  certName: string;
  hasIpa: boolean;
  plistUrl: string;
  downloadLink: string;
}

export default function DownloadPage() {
  const { slug } = useParams<{ slug: string }>();
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tapped, setTapped] = useState(false);
  const logoSrc = useLogoSrc();

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/d/${slug}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "غير موجود");
        return data as DownloadInfo;
      })
      .then(setInfo)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleDownload = () => {
    if (!info) return;
    setTapped(true);
    window.location.href = info.downloadLink;
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "#000", fontFamily: "system-ui, sans-serif" }}
      dir="rtl"
    >
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <img
          src={logoSrc}
          alt="مسماري"
          className="w-20 h-20 rounded-3xl object-contain"
          style={{ boxShadow: `0 0 40px ${A}30` }}
        />
        <span className="text-white/40 text-sm tracking-widest">مسماري+</span>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: A }} />
          <p className="text-white/40 text-sm">جاري التحميل…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-white/70 text-base font-medium">رابط غير صالح</p>
          <p className="text-white/30 text-sm">{error}</p>
        </div>
      )}

      {!loading && info && (
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          {/* App Card */}
          <div
            className="w-full rounded-2xl p-6 flex flex-col items-center gap-4 border"
            style={{ background: "#111", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${A}15` }}
            >
              <Smartphone className="w-8 h-8" style={{ color: A }} />
            </div>
            <div className="text-center">
              <h1 className="text-white text-xl font-bold mb-1">مسماري+</h1>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold transition-all active:scale-95"
              style={{
                background: tapped
                  ? `${A}30`
                  : `linear-gradient(135deg, ${A}, #7aa3ff)`,
                color: tapped ? A : "#000",
              }}
            >
              {tapped
                ? <><CheckCircle2 className="w-5 h-5" />جاري التثبيت…</>
                : <><Download className="w-5 h-5" />تثبيت التطبيق</>
              }
            </button>

            {tapped && (
              <p className="text-white/40 text-xs text-center">
                اضغط على "ثقة" في إعدادات الجهاز بعد التثبيت
              </p>
            )}
          </div>

          {/* Instructions */}
          <div
            className="w-full rounded-2xl p-4 border"
            style={{ background: "#0a0a0a", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <p className="text-white/40 text-xs font-semibold mb-3">خطوات التثبيت</p>
            {[
              "اضغط على زر التثبيت أعلاه",
              "اسمح للمتصفح بفتح رابط التطبيق",
              "اضغط \"ثقة\" عند ظهور رسالة التأكيد",
              "انتظر اكتمال التثبيت",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: `${A}20`, color: A }}
                >
                  {i + 1}
                </span>
                <p className="text-white/50 text-xs">{step}</p>
              </div>
            ))}
          </div>

        </div>
      )}

      <p className="mt-12 text-white/15 text-xs">
        يجب فتح هذه الصفحة من Safari على iPhone أو iPad
      </p>
    </div>
  );
}
