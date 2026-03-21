import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Save, Loader2, RefreshCw, Globe, Instagram, MessageCircle, Phone } from "lucide-react";
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

function TelegramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const SETTING_SECTIONS = [
  {
    icon: Globe,
    label: "المتجر",
    color: A,
    keys: [
      { key: "store_name", label: "اسم المتجر", placeholder: "مسماري", type: "text" },
      { key: "store_description", label: "وصف المتجر", placeholder: "متجر التطبيقات المميز", type: "text" },
    ],
  },
  {
    iconEl: <Phone className="w-3.5 h-3.5" />,
    icon: Phone,
    label: "واتساب",
    color: "#25D366",
    keys: [
      {
        key: "support_whatsapp",
        label: "رابط واتساب",
        placeholder: "https://wa.me/9647xxxxxxxx",
        type: "url",
        hint: "مثال: https://wa.me/9647701234567",
      },
    ],
  },
  {
    iconEl: <span className="w-3.5 h-3.5 flex items-center"><TelegramIcon /></span>,
    icon: null as any,
    label: "تيليكرام",
    color: "#0088CC",
    keys: [
      {
        key: "support_telegram",
        label: "رابط تيليكرام",
        placeholder: "https://t.me/username",
        type: "url",
        hint: "مثال: https://t.me/mismari",
      },
    ],
  },
  {
    icon: Instagram,
    label: "انستقرام",
    color: "#E1306C",
    keys: [
      {
        key: "support_instagram",
        label: "رابط انستقرام",
        placeholder: "https://instagram.com/username",
        type: "url",
        hint: "مثال: https://instagram.com/mismari.co",
      },
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
            <p className="text-white/40 text-xs mt-0.5">إعدادات المتجر وروابط التواصل الاجتماعي</p>
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

        <div className="bg-[#111111] rounded-xl border border-white/5 p-4 text-xs" style={{ color: `${A}99` }}>
          أي تغيير في روابط التواصل الاجتماعي سينعكس تلقائياً على الموقع والتطبيق
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="space-y-5">
            {SETTING_SECTIONS.map(section => (
              <div key={section.label} className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${section.color}25` }}>
                    {section.iconEl ? (
                      <span style={{ color: section.color }}>{section.iconEl}</span>
                    ) : section.icon ? (
                      <section.icon className="w-3.5 h-3.5" style={{ color: section.color }} />
                    ) : null}
                  </div>
                  <h3 className="text-sm font-bold text-white">{section.label}</h3>
                </div>
                <div className="p-5 space-y-3">
                  {section.keys.map((field: any) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: `${section.color}99` }}>{field.label}</label>
                      <input
                        type={field.type}
                        value={settings[field.key] || ""}
                        onChange={e => set(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none placeholder-white/20"
                        dir="ltr"
                        style={{ borderColor: settings[field.key] ? `${section.color}40` : undefined }}
                      />
                      {field.hint && <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{field.hint}</p>}
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
