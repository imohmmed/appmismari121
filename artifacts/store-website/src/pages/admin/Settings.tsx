import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Save, Loader2, RefreshCw, Globe, Instagram, Phone,
  Settings as SettingsIcon, Link2,
  ChevronDown, ChevronUp,
} from "lucide-react";
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

interface SettingField {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  textarea?: boolean;
  toggle?: boolean;
}

interface SettingSection {
  id: string;
  icon: React.ReactNode;
  label: string;
  labelEn: string;
  color: string;
  fields: SettingField[];
}

const SECTIONS: SettingSection[] = [
  {
    id: "store",
    icon: <Globe className="w-3.5 h-3.5" />,
    label: "المتجر",
    labelEn: "Store",
    color: A,
    fields: [
      { key: "store_name", label: "اسم المتجر", placeholder: "مسماري | Mismari", type: "text" },
      { key: "store_description", label: "وصف المتجر", placeholder: "متجر التطبيقات المعدّلة والمميزة", textarea: true },
      { key: "store_logo_url", label: "رابط الشعار", placeholder: "https://...", type: "url" },
    ],
  },
  {
    id: "enrollment",
    icon: <Link2 className="w-3.5 h-3.5" />,
    label: "التسجيل",
    labelEn: "Enrollment",
    color: "#22c55e",
    fields: [
      { key: "enrollment_enabled", label: "تفعيل طلبات التسجيل", toggle: true },
      { key: "auto_approve_enrollment", label: "قبول تلقائي للطلبات", toggle: true },
      { key: "enrollment_message", label: "رسالة الترحيب عند التسجيل", placeholder: "شكراً لتسجيلك في مسماري...", textarea: true },
      { key: "max_devices_per_code", label: "الحد الأقصى للأجهزة لكل كود", placeholder: "1", type: "number" },
    ],
  },
  {
    id: "whatsapp",
    icon: <Phone className="w-3.5 h-3.5" />,
    label: "واتساب",
    labelEn: "WhatsApp",
    color: "#25D366",
    fields: [
      {
        key: "support_whatsapp",
        label: "رابط واتساب الدعم",
        placeholder: "https://wa.me/9647xxxxxxxx",
        type: "url",
        hint: "مثال: https://wa.me/9647701234567",
      },
    ],
  },
  {
    id: "telegram",
    icon: <span className="w-3.5 h-3.5 flex items-center"><TelegramIcon /></span>,
    label: "تيليكرام",
    labelEn: "Telegram",
    color: "#0088CC",
    fields: [
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
    id: "instagram",
    icon: <Instagram className="w-3.5 h-3.5" />,
    label: "انستقرام",
    labelEn: "Instagram",
    color: "#E1306C",
    fields: [
      {
        key: "support_instagram",
        label: "رابط انستقرام",
        placeholder: "https://instagram.com/username",
        type: "url",
        hint: "مثال: https://instagram.com/mismari.co",
      },
    ],
  },
  {
    id: "system",
    icon: <SettingsIcon className="w-3.5 h-3.5" />,
    label: "النظام",
    labelEn: "System",
    color: "#ef4444",
    fields: [
      { key: "maintenance_mode", label: "وضع الصيانة (يحجب المتجر للمستخدمين)", toggle: true },
      { key: "maintenance_message", label: "رسالة الصيانة", placeholder: "المتجر في وضع الصيانة حالياً، يرجى المحاولة لاحقاً", textarea: true },
    ],
  },
];

function ToggleSwitch({ value, onChange, color }: { value: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 py-1 transition-all"
    >
      <div
        className="w-10 h-5 rounded-full relative transition-all duration-200 shrink-0"
        style={{ background: value ? color : "rgba(255,255,255,0.08)" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: value ? "calc(100% - 18px)" : "2px" }}
        />
      </div>
      <span className="text-xs" style={{ color: value ? color : "rgba(255,255,255,0.3)" }}>
        {value ? "مفعّل" : "معطّل"}
      </span>
    </button>
  );
}

function SectionCard({
  section,
  settings,
  onChange,
}: {
  section: SettingSection;
  settings: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${section.color}25` }}>
          <span style={{ color: section.color }}>{section.icon}</span>
        </div>
        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-white">{section.label}</span>
          <span className="text-white/30 text-xs mr-2">{section.labelEn}</span>
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-white/30 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
        }
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {section.fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: `${section.color}bb` }}>
                {field.label}
              </label>
              {field.toggle ? (
                <ToggleSwitch
                  value={settings[field.key] === "true"}
                  onChange={v => onChange(field.key, v ? "true" : "false")}
                  color={section.color}
                />
              ) : field.textarea ? (
                <textarea
                  rows={3}
                  value={settings[field.key] || ""}
                  onChange={e => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  dir="rtl"
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white resize-none focus:outline-none placeholder-white/20 focus:border-white/20"
                  style={settings[field.key] ? { borderColor: `${section.color}30` } : {}}
                />
              ) : (
                <input
                  type={field.type || "text"}
                  value={settings[field.key] || ""}
                  onChange={e => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  dir={field.type === "url" || field.type === "number" ? "ltr" : "rtl"}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none placeholder-white/20 focus:border-white/20"
                  style={settings[field.key] ? { borderColor: `${section.color}30` } : {}}
                />
              )}
              {field.hint && (
                <p className="text-[11px] text-white/25">{field.hint}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/settings");
    const map: Record<string, string> = {};
    for (const s of d?.settings || []) {
      map[s.key] = s.value;
    }
    setSettings(map);
    setDirty(false);
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
      setDirty(false);
    } catch {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleChange = (key: string, val: string) => {
    setSettings(s => ({ ...s, [key]: val }));
    setDirty(true);
  };

  const allKeys = SECTIONS.flatMap(s => s.fields.map(f => f.key));
  const filledCount = allKeys.filter(k => settings[k] && settings[k] !== "false").length;

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-2xl" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">الإعدادات</h2>
            <p className="text-white/40 text-xs mt-0.5">إعدادات المتجر والتواصل الاجتماعي</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchSettings} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !dirty}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black disabled:opacity-40 transition-all"
              style={{ background: A }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#111111] rounded-xl border border-white/8 p-3 text-center">
            <p className="text-xl font-black" style={{ fontFamily: "Outfit", color: A }}>{filledCount}</p>
            <p className="text-white/40 text-xs mt-0.5">إعداد مكتمل</p>
          </div>
          <div className="bg-[#111111] rounded-xl border border-white/8 p-3 text-center">
            <p className="text-xl font-black" style={{ fontFamily: "Outfit", color: settings["maintenance_mode"] === "true" ? "#ef4444" : "#22c55e" }}>
              {settings["maintenance_mode"] === "true" ? "⚠" : "✓"}
            </p>
            <p className="text-white/40 text-xs mt-0.5">حالة المتجر</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="space-y-3">
            {SECTIONS.map(section => (
              <SectionCard
                key={section.id}
                section={section}
                settings={settings}
                onChange={handleChange}
              />
            ))}
          </div>
        )}

        {dirty && (
          <div className="sticky bottom-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-black shadow-2xl"
              style={{ background: A, boxShadow: `0 8px 32px ${A}40` }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
