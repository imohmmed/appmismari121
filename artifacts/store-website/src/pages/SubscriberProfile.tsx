import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Smartphone, Tablet, User, Key, Calendar, Package } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

interface Subscriber {
  code: string;
  subscriberName: string | null;
  deviceType: string | null;
  isActive: string;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  planName: string | null;
  planNameAr: string | null;
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="mt-0.5 text-[#9fbcff]/60">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-white/40 text-xs mb-0.5">{label}</p>
        <p className={`text-white text-sm ${mono ? "font-mono" : ""}`}>{value || <span className="text-white/25">—</span>}</p>
      </div>
    </div>
  );
}

export default function SubscriberProfile({ params }: { params: { code: string } }) {
  const [sub, setSub] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/subscriber/${params.code}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setSub(d.subscriber);
      })
      .catch(() => setError("تعذر تحميل البيانات"))
      .finally(() => setLoading(false));
  }, [params.code]);

  const isActive = sub?.isActive === "true";
  const isExpired = sub?.expiresAt ? new Date(sub.expiresAt) < new Date() : false;

  return (
    <div className="min-h-screen bg-black text-white" dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', 'Outfit', sans-serif" }}>
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <img
            src={`${import.meta.env.BASE_URL}mismari-logo-final.png`}
            alt="Mismari"
            className="h-12 w-auto object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div>
            <h1 className="text-lg font-bold text-white">Mismari | مسماري</h1>
            <p className="text-white/40 text-xs">بطاقة المشترك</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-[#9fbcff]/50" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 font-medium">{error}</p>
            <p className="text-white/30 text-sm mt-1">تأكد من صحة الرابط</p>
          </div>
        ) : sub ? (
          <div className="space-y-4">
            <div className="bg-[#111111] border border-white/8 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#9fbcff20" }}>
                  <User className="w-7 h-7 text-[#9fbcff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">{sub.subscriberName || "مشترك"}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {isActive && !isExpired ? (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> نشط
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3" /> {isExpired ? "منتهي" : "غير نشط"}
                      </span>
                    )}
                    {sub.deviceType && (
                      <span className="flex items-center gap-1 text-xs text-[#9fbcff]/80 bg-[#9fbcff]/10 px-2 py-0.5 rounded-full">
                        {sub.deviceType === "iPad" ? <Tablet className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                        {sub.deviceType}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <InfoRow icon={<Key className="w-4 h-4" />} label="كود الاشتراك" value={<span style={{ color: "#9fbcff" }}>{sub.code}</span>} mono />
                <InfoRow icon={<Package className="w-4 h-4" />} label="الباقة" value={sub.planNameAr || sub.planName} />
              </div>
            </div>

            <div className="bg-[#111111] border border-white/8 rounded-2xl p-5">
              <h3 className="text-white/50 text-xs font-medium mb-3 uppercase tracking-wide">تواريخ الاشتراك</h3>
              <div className="grid grid-cols-1 gap-0">
                <InfoRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="تاريخ التسجيل"
                  value={new Date(sub.createdAt).toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" })}
                />
                {sub.activatedAt && (
                  <InfoRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="تاريخ التفعيل"
                    value={new Date(sub.activatedAt).toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" })}
                  />
                )}
                {sub.expiresAt && (
                  <InfoRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="تاريخ الانتهاء"
                    value={
                      <span style={{ color: isExpired ? "#f87171" : "#4ade80" }}>
                        {new Date(sub.expiresAt).toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    }
                  />
                )}
              </div>
            </div>

            <p className="text-center text-white/20 text-xs pb-4">
              Mismari+ | مسماري
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
