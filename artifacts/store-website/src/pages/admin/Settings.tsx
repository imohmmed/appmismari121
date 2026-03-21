import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Save, Loader2, RefreshCw, Globe, Shield, Bell, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers || {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (res.status === 204) return null;
  return res.json();
}

const SETTING_SECTIONS = [
  {
    icon: Globe,
    label: "المتجر",
    keys: [
      { key: "store_name", label: "اسم المتجر", placeholder: "مسماري", type: "text" },
      { key: "store_name_ar", label: "اسم المتجر بالعربي", placeholder: "مسماري", type: "text" },
      { key: "store_description", label: "وصف المتجر", placeholder: "متجر التطبيقات المميز", type: "text" },
      { key: "support_whatsapp", label: "واتساب الدعم", placeholder: "+9647xxxxxxxx", type: "text" },
      { key: "support_telegram", label: "تيليغرام الدعم", placeholder: "@username", type: "text" },
      { key: "support_instagram", label: "انستغرام", placeholder: "@username", type: "text" },
    ],
  },
  {
    icon: Shield,
    label: "الإدارة",
    keys: [
      { key: "admin_username", label: "اسم المستخدم للأدمن", placeholder: "admin", type: "text" },
      { key: "admin_email", label: "بريد الأدمن", placeholder: "admin@example.com", type: "email" },
    ],
  },
  {
    icon: Palette,
    label: "التصميم",
    keys: [
      { key: "primary_color", label: "اللون الرئيسي", placeholder: "#9fbcff", type: "text" },
      { key: "logo_url", label: "رابط اللوجو", placeholder: "https://...", type: "url" },
    ],
  },
  {
    icon: Bell,
    label: "الإشعارات",
    keys: [
      { key: "telegram_bot_token", label: "Telegram Bot Token", placeholder: "123456:ABC-DEF...", type: "text" },
      { key: "telegram_chat_id", label: "Telegram Chat ID", placeholder: "-100xxxxxxxxx", type: "text" },
    ],
  },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/settings");
    const map: Record<string, string> = {};
    for (const s of d?.settings || []) {
      map[s.key] = s.value;
    }
    setSettings(map);
    setLoading(false);
  };
  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: Object.entries(settings).map(([key, value]) => ({ key, value })),
        }),
      });
      toast({ title: "تم حفظ الإعدادات بنجاح" });
    } catch {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    }
    setSaving(false);
  };

  const set = (key: string, val: string) => setSettings(s => ({ ...s, [key]: val }));

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">الإعدادات</h2>
            <p className="text-white/40 text-xs mt-0.5">إعدادات المتجر والنظام</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchSettings} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={handleSave} disabled={saving || loading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black disabled:opacity-50" style={{ background: A }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ التغييرات
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="space-y-5">
            {SETTING_SECTIONS.map(section => (
              <div key={section.label} className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${A}20` }}>
                    <section.icon className="w-3.5 h-3.5" style={{ color: A }} />
                  </div>
                  <h3 className="text-sm font-bold text-white">{section.label}</h3>
                </div>
                <div className="p-5 space-y-3">
                  {section.keys.map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: `${A}99` }}>{field.label}</label>
                      <input
                        type={field.type}
                        value={settings[field.key] || ""}
                        onChange={e => set(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20"
                        dir={field.type === "url" || field.key.includes("token") || field.key.includes("bot") ? "ltr" : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
