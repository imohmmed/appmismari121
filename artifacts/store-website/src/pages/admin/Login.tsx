import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLogoSrc } from "@/contexts/AppearanceContext";

const API = import.meta.env.VITE_API_URL || "";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const logoSrc = useLogoSrc();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    try {
      const res = await fetch(`${API}/api/admin/captcha`);
      const data = await res.json();
      setCaptchaImage(data.imageData);
      setCaptchaToken(data.token);
    } catch {
      toast({ title: "فشل تحميل رمز التحقق", variant: "destructive" });
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({ title: "يرجى إدخال اسم المستخدم وكلمة المرور", variant: "destructive" });
      return;
    }
    if (!captchaAnswer.trim()) {
      toast({ title: "يرجى إدخال رمز التحقق", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captchaToken, captchaAnswer }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.token) {
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminUsername", data.username || username);
        localStorage.setItem("adminRole", data.role || "admin");
        setLocation("/admin");
        toast({ title: `مرحباً ${data.username} 👋` });
      } else {
        toast({ title: data.error || "بيانات الدخول غير صحيحة", variant: "destructive" });
        loadCaptcha();
      }
    } catch {
      toast({ title: "تعذّر الاتصال بالسيرفر", variant: "destructive" });
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-black" dir="rtl">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#9fbcff]/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#9fbcff]/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-[#111] border border-white/10 rounded-3xl shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <img src={logoSrc} alt="Mismari" className="h-16 w-auto object-contain mx-auto mb-5" />
          <h1 className="text-2xl font-black mb-1 text-white">تسجيل الدخول</h1>
          <p className="text-white/40 text-sm">لوحة إدارة مسماري</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full bg-black border border-white/10 rounded-xl py-3 pr-10 pl-4 text-white text-sm focus:outline-none focus:border-[#9fbcff]/60 focus:ring-1 focus:ring-[#9fbcff]/30 transition-all"
                dir="ltr"
                placeholder="User"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-black border border-white/10 rounded-xl py-3 pr-10 pl-4 text-white text-sm focus:outline-none focus:border-[#9fbcff]/60 focus:ring-1 focus:ring-[#9fbcff]/30 transition-all"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* CAPTCHA */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60">رمز التحقق</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] flex items-center justify-center h-[70px]">
                {captchaLoading ? (
                  <div className="w-6 h-6 border-2 border-[#9fbcff]/40 border-t-[#9fbcff] rounded-full animate-spin" />
                ) : captchaImage ? (
                  <img src={captchaImage} alt="captcha" className="w-full h-full object-contain" draggable={false} />
                ) : null}
              </div>
              <button
                type="button"
                onClick={loadCaptcha}
                disabled={captchaLoading}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-40"
              >
                <RefreshCw className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <input
              type="text"
              value={captchaAnswer}
              onChange={e => setCaptchaAnswer(e.target.value)}
              maxLength={6}
              className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-white text-sm tracking-[0.3em] text-center uppercase focus:outline-none focus:border-[#9fbcff]/60 focus:ring-1 focus:ring-[#9fbcff]/30 transition-all"
              dir="ltr"
              placeholder="أدخل الرمز"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold bg-[#9fbcff] hover:bg-[#7da5ff] text-black shadow-lg shadow-[#9fbcff]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>دخول <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
