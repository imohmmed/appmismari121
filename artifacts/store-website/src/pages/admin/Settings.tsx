import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Save, Loader2, RefreshCw, Instagram, Phone,
  Settings as SettingsIcon, Link2,
  ChevronDown, ChevronUp,
  Shield, Upload, Trash2, Zap, CheckCircle, XCircle, Info,
  Send, Bot, Image as ImageIcon, ToggleLeft, ToggleRight, Eye,
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

async function adminUpload(path: string, fd: FormData) {
  const token = localStorage.getItem("adminToken") || "";
  return fetch(`${API}/api${path}`, {
    method: "POST",
    headers: { "x-admin-token": token },
    body: fd,
  });
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

/* ──────────────────────────────────────────────────────────────────────────
   AIKeysSection — مفاتيح API الخاصة بالذكاء الاصطناعي
────────────────────────────────────────────────────────────────────────── */
function AIKeysSection() {
  const { toast } = useToast();
  const AI = "#9fbcff";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [braveKey, setBraveKey] = useState("");
  const [showOR, setShowOR] = useState(false);
  const [showBrave, setShowBrave] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const d = await adminFetch("/admin/settings");
      const map: Record<string, string> = {};
      for (const s of d?.settings || []) map[s.key] = s.value;
      setOpenrouterKey(map["ai_openrouter_key"] || "");
      setBraveKey(map["ai_brave_key"] || "");
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { if (open) loadKeys(); }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: [
            { key: "ai_openrouter_key", value: openrouterKey.trim() },
            { key: "ai_brave_key",       value: braveKey.trim() },
          ],
        }),
      });
      toast({ title: "✅ تم حفظ مفاتيح AI" });
    } catch {
      toast({ title: "❌ فشل الحفظ", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="bg-[#111111] rounded-xl border overflow-hidden" style={{ borderColor: `${AI}20` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
        style={{ borderBottomColor: open ? `${AI}10` : "transparent" }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${AI}20` }}>
          <Zap className="w-3.5 h-3.5" style={{ color: AI }} />
        </div>
        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-white">مفاتيح الذكاء الاصطناعي</span>
          <span className="text-white/30 text-xs mr-2">AI API Keys</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/30 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : (
            <>
              <div className="p-3 rounded-lg text-xs text-white/50 space-y-0.5" style={{ background: `${AI}08`, border: `1px solid ${AI}15` }}>
                <p>عند إضافة مفتاح جديد، يتم تطبيقه فوراً على كل الذكاء الاصطناعي في المتجر.</p>
                <p className="text-white/30">المفتاح المحفوظ يتجاوز قيمة متغير البيئة (Environment Variable).</p>
              </div>

              {/* OpenRouter Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${AI}bb` }}>OpenRouter API Key</label>
                <div className="relative">
                  <input
                    type={showOR ? "text" : "password"}
                    value={openrouterKey}
                    onChange={e => setOpenrouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    dir="ltr"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 pl-10 pr-3 text-sm text-white font-mono focus:outline-none placeholder-white/20 focus:border-white/20"
                    style={openrouterKey ? { borderColor: `${AI}30` } : {}}
                  />
                  <button type="button" onClick={() => setShowOR(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showOR ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-40" />}
                  </button>
                </div>
                <p className="text-[11px] text-white/25">
                  مفتاح OpenRouter — يبدأ بـ sk-or-v1- · <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: AI }}>احصل على مفتاح</a>
                </p>
              </div>

              {/* Brave Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${AI}bb` }}>Brave Search API Key</label>
                <div className="relative">
                  <input
                    type={showBrave ? "text" : "password"}
                    value={braveKey}
                    onChange={e => setBraveKey(e.target.value)}
                    placeholder="BSA..."
                    dir="ltr"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 pl-10 pr-3 text-sm text-white font-mono focus:outline-none placeholder-white/20 focus:border-white/20"
                    style={braveKey ? { borderColor: `${AI}30` } : {}}
                  />
                  <button type="button" onClick={() => setShowBrave(v => !v)} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showBrave ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-40" />}
                  </button>
                </div>
                <p className="text-[11px] text-white/25">
                  يُستخدم للبحث في الإنترنت داخل مسماري AI · <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: AI }}>احصل على مفتاح</a>
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black disabled:opacity-40 w-full justify-center"
                style={{ background: AI }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "جاري الحفظ..." : "حفظ المفاتيح"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   TelegramBotSection — قسم مستقل لإعدادات بوت التيليكرام
────────────────────────────────────────────────────────────────────────── */
function TelegramBotSection() {
  const { toast } = useToast();
  const TG = "#0088CC";
  const [open, setOpen] = useState(false);

  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [autoPost, setAutoPost] = useState(false);

  const [checking, setChecking] = useState(false);
  const [botInfo, setBotInfo] = useState<{ username?: string; first_name?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [templateInfo, setTemplateInfo] = useState<{ exists: boolean; filename?: string; url?: string } | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const templateRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  /* جلب الإعدادات الحالية */
  const loadSettings = async () => {
    setLoading(true);
    try {
      const d = await adminFetch("/admin/settings");
      const map: Record<string, string> = {};
      for (const s of d?.settings || []) map[s.key] = s.value;
      setBotToken(map["telegram_bot_token"] || "");
      setChannelId(map["telegram_channel_id"] || "");
      setAutoPost(map["telegram_auto_post"] === "true");
    } catch { /* ignore */ }

    try {
      const t = await adminFetch("/admin/telegram/template-info");
      setTemplateInfo(t);
    } catch { setTemplateInfo({ exists: false }); }

    setLoading(false);
  };

  useEffect(() => { if (open) loadSettings(); }, [open]);

  /* فحص التوكن */
  const handleCheck = async () => {
    if (!botToken.trim()) { toast({ title: "أدخل توكن البوت أولاً", variant: "destructive" }); return; }
    setChecking(true);
    const d = await adminFetch("/admin/telegram/check", { method: "POST", body: JSON.stringify({ token: botToken.trim() }) });
    setChecking(false);
    if (d?.ok) { setBotInfo(d.bot); toast({ title: `✅ البوت: @${d.bot?.username}` }); }
    else { setBotInfo(null); toast({ title: "❌ " + (d?.error || "توكن غير صحيح"), variant: "destructive" }); }
  };

  /* حفظ الإعدادات */
  const handleSave = async () => {
    setSaving(true);
    await adminFetch("/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        settings: [
          { key: "telegram_bot_token", value: botToken.trim() },
          { key: "telegram_channel_id", value: channelId.trim() },
          { key: "telegram_auto_post", value: autoPost ? "true" : "false" },
        ],
      }),
    });
    setSaving(false);
    toast({ title: "✅ تم حفظ إعدادات البوت" });
  };

  /* رفع قالب الصورة */
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTemplate(true);
    const fd = new FormData();
    fd.append("template", file);
    const res = await adminUpload("/admin/telegram/upload-template", fd);
    const d = await res.json();
    setUploadingTemplate(false);
    if (d?.ok) {
      toast({ title: "✅ تم رفع القالب" });
      setTemplateInfo({ exists: true, filename: d.filename, url: d.url });
    } else {
      toast({ title: "❌ فشل رفع القالب", variant: "destructive" });
    }
    if (templateRef.current) templateRef.current.value = "";
  };

  /* حذف القالب */
  const handleTemplateDelete = async () => {
    await adminFetch("/admin/telegram/template", { method: "DELETE" });
    setTemplateInfo({ exists: false });
    toast({ title: "تم حذف القالب" });
  };

  /* إرسال رسالة اختبار */
  const handleTest = async () => {
    if (!botToken.trim() || !channelId.trim()) {
      toast({ title: "أدخل التوكن ومعرف القناة أولاً", variant: "destructive" });
      return;
    }
    setTesting(true);
    const d = await adminFetch("/admin/telegram/test", {
      method: "POST",
      body: JSON.stringify({ token: botToken.trim(), channelId: channelId.trim() }),
    });
    setTesting(false);
    if (d?.ok) toast({ title: "✅ تم إرسال رسالة اختبار للقناة!" });
    else toast({ title: "❌ " + (d?.error || "فشل الإرسال"), variant: "destructive" });
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${TG}25`, background: `${TG}06` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${TG}25` }}>
          <Bot className="w-3.5 h-3.5" style={{ color: TG }} />
        </div>
        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-white">بوت النشر التلقائي</span>
          <span className="text-white/30 text-xs mr-2">Telegram Auto-Post Bot</span>
        </div>
        {autoPost && !open && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${TG}20`, color: TG }}>مفعّل</span>
        )}
        {botInfo && !open && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#22c55e15", color: "#22c55e" }}>@{botInfo.username}</span>
        )}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/30 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 py-4 space-y-5 border-t" style={{ borderColor: `${TG}15` }}>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : (
            <>
              {/* شرح سريع */}
              <div className="rounded-lg px-3 py-2.5 text-xs text-white/40 leading-relaxed" style={{ background: "rgba(0,136,204,0.07)" }}>
                <strong style={{ color: TG }}>كيف يعمل:</strong> أضف البوت أدمناً في قناتك ← أدخل التوكن ← أدخل Chat ID للقناة ← ارفع قالب الصورة (اختياري) ← فعّل النشر التلقائي
              </div>

              {/* توكن البوت */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${TG}bb` }}>توكن البوت <span className="text-white/25">(من @BotFather)</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={botToken}
                    onChange={e => setBotToken(e.target.value)}
                    placeholder="123456789:AABBccDDee..."
                    dir="ltr"
                    className="flex-1 bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white font-mono focus:outline-none placeholder-white/20 focus:border-white/20"
                    style={botToken ? { borderColor: `${TG}30` } : {}}
                  />
                  <button
                    onClick={handleCheck}
                    disabled={checking}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0"
                    style={{ background: `${TG}20`, color: TG }}
                  >
                    {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    فحص
                  </button>
                </div>
                {botInfo && (
                  <p className="text-xs" style={{ color: "#22c55e" }}>
                    ✅ البوت: <strong>{botInfo.first_name}</strong> — @{botInfo.username}
                  </p>
                )}
              </div>

              {/* معرف القناة */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${TG}bb` }}>Chat ID للقناة</label>
                <input
                  type="text"
                  value={channelId}
                  onChange={e => setChannelId(e.target.value)}
                  placeholder="-100xxxxxxxxxx أو @channel_username"
                  dir="ltr"
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white font-mono focus:outline-none placeholder-white/20 focus:border-white/20"
                  style={channelId ? { borderColor: `${TG}30` } : {}}
                />
                <p className="text-[11px] text-white/25">
                  للحصول على Chat ID: أرسل أي رسالة للقناة ← افتح @userinfobot أو @RawDataBot وأعد توجيه الرسالة إليه
                </p>
              </div>

              {/* النشر التلقائي */}
              <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">النشر التلقائي</p>
                  <p className="text-xs text-white/35 mt-0.5">ينشر تلقائياً عند إضافة أو تحديث تطبيق</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPost(v => !v)}
                  className="flex items-center gap-2 text-sm font-bold"
                  style={{ color: autoPost ? TG : "rgba(255,255,255,0.3)" }}
                >
                  {autoPost
                    ? <ToggleRight className="w-8 h-8" style={{ color: TG }} />
                    : <ToggleLeft className="w-8 h-8 text-white/20" />
                  }
                </button>
              </div>

              {/* قالب الصورة */}
              <div className="space-y-2">
                <label className="text-xs font-medium" style={{ color: `${TG}bb` }}>قالب الصورة (اختياري)</label>
                <div className="bg-white/[0.03] rounded-xl px-4 py-3 flex items-center gap-3">
                  {templateInfo?.exists ? (
                    <>
                      <img
                        src={`${API}${templateInfo.url}`}
                        alt="قالب"
                        className="w-14 h-14 object-cover rounded-lg border border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/70 truncate">{templateInfo.filename}</p>
                        <p className="text-[11px] text-white/30 mt-0.5">أيقونة التطبيق ستُوضع فوق هذا القالب</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => templateRef.current?.click()}
                          disabled={uploadingTemplate}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: `${TG}18`, color: TG }}
                        >
                          <Upload className="w-3.5 h-3.5" />تغيير
                        </button>
                        <button
                          onClick={handleTemplateDelete}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "#ef444418", color: "#ef4444" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />حذف
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full text-center space-y-2">
                      <ImageIcon className="w-8 h-8 mx-auto text-white/15" />
                      <p className="text-xs text-white/30">لا يوجد قالب — سترسل أيقونة التطبيق مباشرة</p>
                      <button
                        onClick={() => templateRef.current?.click()}
                        disabled={uploadingTemplate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                        style={{ background: `${TG}20`, color: TG }}
                      >
                        {uploadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {uploadingTemplate ? "جاري الرفع..." : "رفع قالب صورة"}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-white/20 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  ارفع صورة خلفية (PNG/JPG) — سيتم تركيب أيقونة التطبيق في الزاوية العلوية اليمنى تلقائياً
                </p>
                <input ref={templateRef} type="file" accept="image/*" className="hidden" onChange={handleTemplateUpload} />
              </div>

              {/* أزرار الحفظ والاختبار */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black"
                  style={{ background: TG }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: `${TG}18`, color: TG }}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testing ? "جاري الإرسال..." : "إرسال اختبار"}
                </button>
              </div>

              {/* شرح شكل المنشور */}
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                  <p className="text-xs font-bold text-white/50">شكل المنشور في القناة</p>
                </div>
                <div className="px-4 py-3 space-y-1 text-xs font-mono text-white/40 dir-ltr" dir="ltr">
                  <p>[صورة القالب + أيقونة التطبيق]</p>
                  <p>📱 <strong className="text-white/60">اسم التطبيق</strong> v1.0.0</p>
                  <p className="mt-1">الوصف بالعربي...</p>
                  <p>English Description...</p>
                  <p className="mt-1">🔗 @channel_username</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   StoreDylibSection — رفع دايلب مسماري+ (المتجر)
   mismari-store.dylib يُحقن في تطبيق مسماري+ فقط — لا يمس تطبيقات المستخدمين
────────────────────────────────────────────────────────────────────────── */
function StoreDylibSection() {
  const { toast } = useToast();
  const C = "#22c55e";
  const [open, setOpen] = useState(false);
  const storeDylibRef = useRef<HTMLInputElement>(null);
  const [storeDylibStatus, setStoreDylibStatus] = useState<{ exists: boolean; size?: number; updatedAt?: string } | null>(null);
  const [uploadingStore, setUploadingStore] = useState(false);

  const fetchStatus = async () => {
    try {
      const d = await adminFetch("/admin/store-dylib/status");
      setStoreDylibStatus(d);
    } catch { setStoreDylibStatus({ exists: false }); }
  };

  useEffect(() => { if (open) fetchStatus(); }, [open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStore(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminUpload("/admin/store-dylib/upload", fd);
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم رفع دايلب المتجر", description: `الحجم: ${(data.size / 1024).toFixed(1)} KB` });
        fetchStatus();
      } else {
        toast({ title: "فشل الرفع", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "فشل الرفع", variant: "destructive" });
    }
    setUploadingStore(false);
    if (storeDylibRef.current) storeDylibRef.current.value = "";
  };

  const handleDelete = async () => {
    await adminFetch("/admin/store-dylib", { method: "DELETE" });
    toast({ title: "تم حذف دايلب المتجر" });
    fetchStatus();
  };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${C}25`, background: `${C}06` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${C}15` }}>
          <Shield className="w-5 h-5" style={{ color: C }} />
        </div>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-bold text-sm">دايلب المتجر</h3>
            <span className="text-white/30 text-xs">mismari-store.dylib</span>
            {storeDylibStatus?.exists && !open && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${C}20`, color: C }}>
                مرفوع ✓
              </span>
            )}
          </div>
          <p className="text-white/30 text-xs mt-0.5 text-right">
            يُحقن في مسماري+ فقط — JB bypass · Safe Mode · Auto-Update · Welcome
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: `${C}15` }}>

          {/* مميزات الدايلب */}
          <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: `${C}08`, border: `1px solid ${C}18` }}>
            <p className="text-xs font-bold mb-2" style={{ color: C }}>مميزات mismari-store.dylib</p>
            {[
              { icon: "①", text: "JB Bypass — يخفي مسارات Cydia/Substrate عن كود المتجر (fishhook + NSFileManager)" },
              { icon: "②", text: "Bundle ID Masking — يمنع انكشاف Bundle ID عند تغيير الشهادة" },
              { icon: "③", text: "Auto-Update — يفحص التحديثات كل 30 دقيقة ويعرض Alert للمستخدم" },
              { icon: "④", text: "Safe Mode — بعد 3 crashes في 8 ثواني يُعطِّل الـ hooks تلقائياً" },
              { icon: "⑤", text: "Integrity Check — يكتشف الحقن الخارجي غير الشرعي (DYLD_INSERT_LIBRARIES)" },
              { icon: "⑥", text: "Welcome Alert — رسالة ترحيب عند أول تشغيل لكل إصدار جديد" },
            ].map(f => (
              <div key={f.icon} className="flex items-start gap-2 text-xs text-white/50">
                <span className="shrink-0 font-bold" style={{ color: `${C}99` }}>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t text-[11px] text-white/30" style={{ borderColor: `${C}15` }}>
              التشفير: XOR KEY=0xAB · XSTR Stack Buffer · Symbol Strip · fishhook · Theos library.mk
            </div>
          </div>

          {/* حالة الملف + رفع */}
          <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-white/60 text-xs font-medium">mismari-store.dylib</span>
                {storeDylibStatus?.exists ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: `${C}15`, color: C }}>
                    مرفوع ✓ ({((storeDylibStatus.size || 0) / 1024).toFixed(0)} KB)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>
                    غير مرفوع
                  </span>
                )}
              </div>
              {storeDylibStatus?.updatedAt && (
                <p className="text-white/20 text-xs">آخر تحديث: {new Date(storeDylibStatus.updatedAt).toLocaleString("ar-SA")}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => storeDylibRef.current?.click()}
                disabled={uploadingStore}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: `${C}18`, color: C }}
              >
                {uploadingStore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingStore ? "جاري الرفع..." : "رفع"}
              </button>
              <input ref={storeDylibRef} type="file" accept=".dylib" className="hidden" onChange={handleUpload} />
              {storeDylibStatus?.exists && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: "#ef444418", color: "#ef4444" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />حذف
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-white/25 flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            هذا الدايلب لمسماري+ فقط — لا يُحقن في تطبيقات المستخدمين أو الألعاب
          </p>
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

  const dylibRef = useRef<HTMLInputElement>(null);
  const [dylibStatus, setDylibStatus] = useState<{ exists: boolean; size?: number; updatedAt?: string } | null>(null);
  const [uploadingDylib, setUploadingDylib] = useState(false);
  const [signingAll, setSigningAll] = useState(false);
  const [signResults, setSignResults] = useState<any>(null);
  const [signIpaUrl, setSignIpaUrl] = useState("https://app.mismari.com/ipa/Mismari-Plus-Unsigned.ipa");

  const fetchDylibStatus = async () => {
    try {
      const data = await adminFetch("/admin/dylib/status");
      setDylibStatus(data);
    } catch { setDylibStatus({ exists: false }); }
  };

  const handleUploadDylib = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDylib(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminUpload("/admin/dylib/upload", fd);
      const data = await res.json();
      if (data.success) {
        toast({ title: "تم رفع ملف Anti-Revoke بنجاح", description: `الحجم: ${(data.size / 1024).toFixed(1)} KB` });
        fetchDylibStatus();
      } else {
        toast({ title: "فشل الرفع", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "فشل الرفع", variant: "destructive" });
    }
    setUploadingDylib(false);
    if (dylibRef.current) dylibRef.current.value = "";
  };

  const handleDeleteDylib = async () => {
    try {
      await adminFetch("/admin/dylib", { method: "DELETE" });
      toast({ title: "تم حذف ملف Anti-Revoke" });
      fetchDylibStatus();
    } catch {
      toast({ title: "فشل الحذف", variant: "destructive" });
    }
  };

  const handleSignAll = async () => {
    if (!signIpaUrl.trim()) {
      toast({ title: "أدخل رابط IPA أولاً", variant: "destructive" });
      return;
    }
    setSigningAll(true);
    setSignResults(null);
    try {
      const data = await adminFetch("/admin/groups/sign-all", {
        method: "POST",
        body: JSON.stringify({ ipaUrl: signIpaUrl.trim() }),
      });
      if (data.success) {
        setSignResults(data);
        toast({
          title: `تم التوقيع: ${data.successCount}/${data.total} مجموعة`,
          description: data.hasDylib ? "مع حقن Anti-Revoke ✓" : "بدون Anti-Revoke (لم يُرفع ملف dylib)",
        });
      } else {
        toast({ title: "فشل التوقيع", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "فشل التوقيع", variant: "destructive" });
    }
    setSigningAll(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/settings");
    const map: Record<string, string> = {};
    for (const s of d?.settings || []) {
      map[s.key] = s.value;
    }
    setSettings(map);
    if (map["store_ipa_url"]) {
      setSignIpaUrl(map["store_ipa_url"]);
    }
    setDirty(false);
    setLoading(false);
  };
  useEffect(() => { fetchSettings(); fetchDylibStatus(); }, []);

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
            <AIKeysSection />
            <TelegramBotSection />
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

        {/* ── دايلب المتجر — فوق Anti-Revoke ─────────────────────────── */}
        <StoreDylibSection />

        <div className="rounded-2xl border overflow-hidden mt-2" style={{ borderColor: "#f59e0b25", background: "#f59e0b06" }}>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#f59e0b15" }}>
                <Shield className="w-5 h-5" style={{ color: "#f59e0b" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-bold text-sm">Anti-Revoke</h3>
                  <span className="text-white/30 text-xs">antirevoke.dylib</span>
                </div>
                <p className="text-white/35 text-xs mt-0.5">
                  يُحقن في تطبيقات المستخدمين والألعاب — ارفع dylib ← أدخل IPA ← وقّع للكل
                </p>
              </div>
            </div>

            {/* مميزات antirevoke.dylib */}
            <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: "#f59e0b08", border: "1px solid #f59e0b18" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "#f59e0b" }}>مميزات antirevoke.dylib (9 Modules)</p>
              {[
                { icon: "①", text: "Anti-Debugging — ptrace(PT_DENY_ATTACH) + sysctl — يمنع lldb/frida/cycript" },
                { icon: "②", text: "OCSP Block — يحجب مواقع التحقق من إلغاء الشهادة (قلب الـ Anti-Revoke)" },
                { icon: "③", text: "SSL Unpinning — يقبل أي شهادة SSL بغض النظر عن Certificate Pinning" },
                { icon: "④", text: "Bundle ID Guard — يمنع اكتشاف التطبيق أنه مثبت خارج App Store" },
                { icon: "⑤", text: "Fake Device Info — IDFV=nil · Device Name جنيريك — يمنع Device Ban والتتبع" },
                { icon: "⑥", text: "File Path Shadow — يخفي مسارات Cydia/Substrate/Tweaks عن التطبيقات الذكية" },
                { icon: "⑦", text: "URL Scheme Filter — يحجب canOpenURL لـ 9 تطبيقات JB (cydia/sileo/filza/...)" },
                { icon: "⑧", text: "Env Variable Hide — يخفي DYLD_INSERT_LIBRARIES وغيرها — أعمق طبقة حماية" },
                { icon: "⑨", text: "Swizzle Ghost — يخفي الـ hooks عن method_getImplementation (ضد Epic/Tencent)" },
              ].map(f => (
                <div key={f.icon} className="flex items-start gap-2 text-xs text-white/50">
                  <span className="shrink-0 font-bold" style={{ color: "#f59e0b99" }}>{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t text-[11px] text-white/30" style={{ borderColor: "#f59e0b15" }}>
                التشفير: XOR KEY=0x42 · MSM_STACK (no malloc) · Symbol Strip · Theos tweak.mk · arm64+arm64e
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white/60 text-xs font-medium">ملف Anti-Revoke (.dylib)</span>
                  {dylibStatus?.exists ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#22c55e15", color: "#22c55e" }}>
                      مرفوع ✓ ({((dylibStatus.size || 0) / 1024).toFixed(0)} KB)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>
                      غير مرفوع
                    </span>
                  )}
                </div>
                {dylibStatus?.updatedAt && (
                  <p className="text-white/20 text-xs">آخر تحديث: {new Date(dylibStatus.updatedAt).toLocaleString("ar-SA")}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dylibRef.current?.click()}
                  disabled={uploadingDylib}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "#f59e0b18", color: "#f59e0b" }}>
                  {uploadingDylib ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingDylib ? "جاري الرفع..." : "رفع dylib"}
                </button>
                <input ref={dylibRef} type="file" accept=".dylib" className="hidden" onChange={handleUploadDylib} />
                {dylibStatus?.exists && (
                  <button onClick={handleDeleteDylib}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: "#ef444418", color: "#ef4444" }}>
                    <Trash2 className="w-3.5 h-3.5" />حذف
                  </button>
                )}
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-2">
              <span className="text-white/60 text-xs font-medium">رابط IPA الأصلي (غير موقّع)</span>
              <div className="flex gap-2 items-center">
                <input
                  type="url"
                  value={signIpaUrl}
                  onChange={e => setSignIpaUrl(e.target.value)}
                  onBlur={e => {
                    const url = e.target.value.trim();
                    if (url) {
                      adminFetch("/admin/settings", {
                        method: "PUT",
                        body: JSON.stringify({ settings: [{ key: "store_ipa_url", value: url }] }),
                      }).catch(() => {});
                    }
                  }}
                  placeholder="https://app.mismari.com/ipa/Mismari-Plus-Unsigned.ipa"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 font-mono outline-none focus:border-white/20"
                  dir="ltr"
                  onKeyDown={e => e.key === "Enter" && handleSignAll()}
                />
                <button
                  onClick={handleSignAll}
                  disabled={signingAll || !signIpaUrl.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors shrink-0"
                  style={{ background: "#f59e0b", color: "#000" }}>
                  {signingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {signingAll ? "جاري التوقيع..." : "توقيع للكل"}
                </button>
              </div>
              {!dylibStatus?.exists && (
                <p className="text-white/25 text-xs flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  لم يُرفع ملف dylib — سيتم التوقيع بدون Anti-Revoke
                </p>
              )}
            </div>

            {signResults && (
              <div className="bg-white/[0.03] rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-white/70 text-sm font-bold">نتائج التوقيع</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#22c55e15", color: "#22c55e" }}>
                    {signResults.successCount} نجح
                  </span>
                  {signResults.failedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#ef444415", color: "#ef4444" }}>
                      {signResults.failedCount} فشل
                    </span>
                  )}
                  {signResults.hasDylib && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "#f59e0b15", color: "#f59e0b" }}>
                      Anti-Revoke ✓
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {signResults.results?.map((r: any) => (
                    <div key={r.groupId} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                      <span className="text-white/60">{r.certName}</span>
                      {r.success ? (
                        <span className="flex items-center gap-1.5" style={{ color: "#22c55e" }}>
                          <CheckCircle className="w-3 h-3" />تم
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5" style={{ color: "#ef4444" }}>
                          <XCircle className="w-3 h-3" />{r.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
