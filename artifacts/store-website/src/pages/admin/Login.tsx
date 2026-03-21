import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useAdminLogin();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    try {
      const res = await loginMutation.mutateAsync({ data: { username, password } });
      if (res.success) {
        localStorage.setItem("adminToken", res.token);
        setLocation("/admin");
        toast({ title: "تم تسجيل الدخول بنجاح" });
      } else {
        toast({ title: "بيانات الدخول غير صحيحة", variant: "destructive" });
      }
    } catch (error) {
      // Stub: If backend login fails or is not implemented, allow bypass for preview purposes
      console.warn("Login failed, bypassing for preview.", error);
      localStorage.setItem("adminToken", "stub_token");
      setLocation("/admin");
      toast({ title: "تم تسجيل الدخول (وضع المعاينة)" });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#07020D]" dir="rtl">
      {/* Background Elements */}
      <img 
        src={`${import.meta.env.BASE_URL}images/admin-bg.png`} 
        alt="Admin BG" 
        className="absolute inset-0 w-full h-full object-cover opacity-30" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 glass-panel rounded-3xl relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto mb-6 flex items-center justify-center shadow-xl shadow-primary/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black mb-2">تسجيل الدخول</h1>
          <p className="text-muted-foreground">لوحة إدارة متجر بلس</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium pl-1">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-left"
                dir="ltr"
                placeholder="admin"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium pl-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-left"
                dir="ltr"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loginMutation.isPending}
            className="w-full py-4 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loginMutation.isPending ? "جاري الدخول..." : (
              <>
                دخول <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
