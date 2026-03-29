import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Save, Loader2, Upload, Trash2, RefreshCw,
  Globe, Palette, Type, Image as ImageIcon, Megaphone,
  ChevronDown, ChevronUp, Moon, Sun, Monitor, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { applyAppearanceToDom, type AppearanceSettings } from "@/contexts/AppearanceContext";

const API = import.meta.env.VITE_API_URL || "";
const ACCENT = "var(--aa, #9fbcff)";

const FONT_OPTIONS = [
  { value: "Tajawal",          label: "Tajawal — طجوال" },
  { value: "Cairo",            label: "Cairo — القاهرة" },
  { value: "Noto_Sans_Arabic", label: "Noto Sans Arabic" },
  { value: "Amiri",            label: "Amiri — أميري" },
  { value: "IBM_Plex_Arabic",  label: "IBM Plex Arabic" },
];

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers || {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
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

/* ─── Colour picker inline ───────────────────────────────────────────────── */
function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-white/40">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 shrink-0 cursor-pointer">
          <div className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-black border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white font-mono focus:outline-none focus:border-white/25"
          maxLength={7}
        />
      </div>
    </div>
  );
}

/* ─── Section collapsible ────────────────────────────────────────────────── */
function Section({ icon, title, subtitle, color = "#9fbcff", children }: {
  icon: React.ReactNode; title: string; subtitle?: string; color?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${color}20`, background: `${color}05` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-white">{title}</span>
          {subtitle && <span className="text-white/30 text-xs mr-2">{subtitle}</span>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/30 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />}
      </button>
      {open && <div className="px-5 py-4 space-y-4 border-t border-white/5">{children}</div>}
    </div>
  );
}

/* ─── Image uploader ─────────────────────────────────────────────────────── */
function ImageUploader({
  label, hint, url, uploadPath, settingKey, accent = "#9fbcff",
  onUploaded,
}: {
  label: string; hint?: string; url: string; uploadPath: string; settingKey: string;
  accent?: string; onUploaded: (url: string) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await adminUpload(uploadPath, fd);
      const d = await res.json();
      if (d?.ok) {
        onUploaded(d.url);
        toast({ title: `✅ تم رفع ${label}` });
      } else {
        toast({ title: "❌ فشل الرفع", variant: "destructive" });
      }
    } catch {
      toast({ title: "❌ فشل الرفع", variant: "destructive" });
    }
    setUploading(false);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: `${accent}aa` }}>{label}</label>
      <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
        {url ? (
          <img src={`${API}${url}`} alt={label} className="w-12 h-12 object-contain rounded-lg border border-white/10 shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg border border-white/10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 text-white/15" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {url ? (
            <p className="text-xs text-white/50 truncate font-mono">{url}</p>
          ) : (
            <p className="text-xs text-white/30">لم يتم الرفع بعد</p>
          )}
          {hint && <p className="text-[11px] text-white/20 mt-0.5">{hint}</p>}
        </div>
        <button
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shrink-0"
          style={{ background: `${accent}18`, color: accent }}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "جاري..." : "رفع"}
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   الصفحة الرئيسية
════════════════════════════════════════════════════════════════════════════ */
export default function AdminAppearance() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<AppearanceSettings>({
    appearance_site_name: "Mismari | مسماري",
    appearance_app_name: "مسماري",
    appearance_site_description: "",
    appearance_logo_url: "",
    appearance_favicon_url: "",
    appearance_og_image_url: "",
    appearance_font_family: "Tajawal",
    appearance_font_file_url: "",
    appearance_web_primary: "#9fbcff",
    appearance_web_text: "#ffffff",
    appearance_web_bg: "#2b283b",
    appearance_admin_bg: "#000000",
    appearance_admin_text: "#ffffff",
    appearance_admin_accent: "#9fbcff",
    appearance_app_light_primary: "#9fbcff",
    appearance_app_light_text: "#2b283b",
    appearance_app_light_bg: "#ffffff",
    appearance_app_dark_primary: "#9fbcff",
    appearance_app_dark_text: "#ffffff",
    appearance_app_dark_bg: "#2b283b",
    appearance_announcement_on: "false",
    appearance_announcement_text: "",
    appearance_announcement_color: "#9fbcff",
    appearance_seo_keywords: "",
  });

  /* تحديث CSS مباشرة عند تغيير أي لون */
  useEffect(() => {
    applyAppearanceToDom(s);
  }, [
    s.appearance_web_primary, s.appearance_web_text, s.appearance_web_bg,
    s.appearance_admin_accent, s.appearance_admin_bg, s.appearance_admin_text,
  ]);

  const set = (key: keyof AppearanceSettings, val: string) =>
    setS(prev => ({ ...prev, [key]: val }));

  /* جلب البيانات */
  const load = async () => {
    setLoading(true);
    try {
      const d = await fetch(`${API}/api/appearance`).then(r => r.json());
      setS(prev => ({ ...prev, ...d }));
    } catch { /**/ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  /* حفظ */
  const save = async () => {
    setSaving(true);
    try {
      const settings = Object.entries(s).map(([key, value]) => ({ key, value }));
      await adminFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      });
      applyAppearanceToDom(s);
      toast({ title: "✅ تم حفظ إعدادات المظهر" });
    } catch {
      toast({ title: "❌ فشل الحفظ", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-2xl" dir="rtl">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">المظهر</h2>
            <p className="text-white/40 text-xs mt-0.5">تحكم كامل في مظهر الموقع، التطبيق، ولوحة الأدمن</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={save}
              disabled={saving || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black disabled:opacity-40"
              style={{ background: "var(--aa, #9fbcff)" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="space-y-3">

            {/* ════ الهوية ════ */}
            <Section icon={<Globe className="w-3.5 h-3.5" />} title="الهوية والمعلومات" subtitle="Identity" color="#9fbcff">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9fbcff99]">اسم الموقع (يظهر في تبويب المتصفح)</label>
                  <input
                    value={s.appearance_site_name}
                    onChange={e => set("appearance_site_name", e.target.value)}
                    placeholder="Mismari | مسماري"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none placeholder-white/20 focus:border-white/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9fbcff99]">اسم التطبيق في Plus وSign</label>
                  <input
                    value={s.appearance_app_name}
                    onChange={e => set("appearance_app_name", e.target.value)}
                    placeholder="مسماري"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none placeholder-white/20 focus:border-white/20"
                  />
                  <p className="text-[11px] text-white/25">يظهر هكذا: [الاسم]+ في شاشة Plus، و [الاسم] Sign في شاشة Sign</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9fbcff99]">وصف الموقع (SEO)</label>
                  <textarea
                    rows={2}
                    value={s.appearance_site_description}
                    onChange={e => set("appearance_site_description", e.target.value)}
                    placeholder="متجر التطبيقات المعدّلة والمميزة..."
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white resize-none focus:outline-none placeholder-white/20 focus:border-white/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9fbcff99]">الكلمات المفتاحية (Keywords)</label>
                  <input
                    value={s.appearance_seo_keywords}
                    onChange={e => set("appearance_seo_keywords", e.target.value)}
                    placeholder="مسماري, تطبيقات مجانية, iOS, ipa"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none placeholder-white/20 focus:border-white/20"
                  />
                </div>
              </div>
            </Section>

            {/* ════ الصور ════ */}
            <Section icon={<ImageIcon className="w-3.5 h-3.5" />} title="الصور والأيقونات" subtitle="Images" color="#22c55e">
              <ImageUploader
                label="اللوغو"
                hint="PNG شفاف، يظهر في الهيدر والسايدبار"
                url={s.appearance_logo_url}
                uploadPath="/admin/appearance/upload-logo"
                settingKey="appearance_logo_url"
                accent="#22c55e"
                onUploaded={url => set("appearance_logo_url", url)}
              />
              <ImageUploader
                label="الفافيكون (أيقونة المتصفح)"
                hint="ICO أو PNG بحجم 32×32 أو 64×64"
                url={s.appearance_favicon_url}
                uploadPath="/admin/appearance/upload-favicon"
                settingKey="appearance_favicon_url"
                accent="#22c55e"
                onUploaded={url => set("appearance_favicon_url", url)}
              />
              <ImageUploader
                label="صورة المشاركة (OG Image)"
                hint="تظهر عند مشاركة الرابط في واتساب، تويتر، تيليكرام — 1200×630"
                url={s.appearance_og_image_url}
                uploadPath="/admin/appearance/upload-og"
                settingKey="appearance_og_image_url"
                accent="#22c55e"
                onUploaded={url => set("appearance_og_image_url", url)}
              />
            </Section>

            {/* ════ الخط ════ */}
            <Section icon={<Type className="w-3.5 h-3.5" />} title="الخط" subtitle="Font" color="#f59e0b">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#f59e0baa]">اختيار الخط</label>
                  <select
                    value={s.appearance_font_family}
                    onChange={e => set("appearance_font_family", e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none"
                  >
                    {FONT_OPTIONS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#f59e0baa]">أو ارفع ملف خط مخصص (.ttf / .woff2)</label>
                  <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      {s.appearance_font_file_url ? (
                        <p className="text-xs text-white/50 truncate font-mono">{s.appearance_font_file_url}</p>
                      ) : (
                        <p className="text-xs text-white/30">لا يوجد ملف مرفوع — سيستخدم خط Google</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ background: "#f59e0b18", color: "#f59e0b" }}>
                        <Upload className="w-3.5 h-3.5" />رفع خط
                        <input
                          type="file"
                          accept=".ttf,.woff,.woff2,.otf"
                          className="hidden"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await adminUpload("/admin/appearance/upload-font", fd);
                            const d = await res.json();
                            if (d?.ok) set("appearance_font_file_url", d.url);
                          }}
                        />
                      </label>
                      {s.appearance_font_file_url && (
                        <button
                          onClick={() => set("appearance_font_file_url", "")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "#ef444418", color: "#ef4444" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />حذف
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-white/20">الخط المرفوع يتجاوز اختيار Google Fonts</p>
                </div>
              </div>
            </Section>

            {/* ════ ألوان الموقع ════ */}
            <Section icon={<Palette className="w-3.5 h-3.5" />} title="ألوان الموقع" subtitle="Website Colors" color="#9fbcff">
              <p className="text-[11px] text-white/30">التغيير فوري — اضغط حفظ لتثبيت التغييرات</p>
              <div className="grid grid-cols-3 gap-4">
                <ColorPicker label="اللون الرئيسي" value={s.appearance_web_primary} onChange={v => set("appearance_web_primary", v)} />
                <ColorPicker label="لون النص"      value={s.appearance_web_text}    onChange={v => set("appearance_web_text", v)} />
                <ColorPicker label="لون الخلفية"   value={s.appearance_web_bg}      onChange={v => set("appearance_web_bg", v)} />
              </div>
              <div className="flex items-center gap-2 mt-2 rounded-xl px-4 py-3 border border-white/5">
                <span className="text-xs text-white/40 ml-auto">معاينة:</span>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: s.appearance_web_primary, color: "#000" }}>زر رئيسي</div>
                  <div className="px-3 py-1 rounded-full text-xs" style={{ background: s.appearance_web_bg, color: s.appearance_web_text, border: `1px solid ${s.appearance_web_primary}40` }}>خلفية + نص</div>
                </div>
              </div>
            </Section>

            {/* ════ ألوان الأدمن ════ */}
            <Section icon={<Palette className="w-3.5 h-3.5" />} title="ألوان لوحة الأدمن" subtitle="Admin Panel Colors" color="#a78bfa">
              <p className="text-[11px] text-white/30">التغيير فوري في لوحة الأدمن الحالية</p>
              <div className="grid grid-cols-3 gap-4">
                <ColorPicker label="لون التمييز (Accent)" value={s.appearance_admin_accent} onChange={v => set("appearance_admin_accent", v)} />
                <ColorPicker label="لون الخلفية"          value={s.appearance_admin_bg}     onChange={v => set("appearance_admin_bg", v)} />
                <ColorPicker label="لون النص"             value={s.appearance_admin_text}   onChange={v => set("appearance_admin_text", v)} />
              </div>
            </Section>

            {/* ════ ألوان التطبيق ════ */}
            <Section icon={<Monitor className="w-3.5 h-3.5" />} title="ألوان التطبيق" subtitle="App Colors" color="#fb923c">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-sm font-bold text-white">الوضع النهاري (Light)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <ColorPicker label="اللون الرئيسي" value={s.appearance_app_light_primary} onChange={v => set("appearance_app_light_primary", v)} />
                    <ColorPicker label="لون النص"      value={s.appearance_app_light_text}    onChange={v => set("appearance_app_light_text", v)} />
                    <ColorPicker label="لون الخلفية"   value={s.appearance_app_light_bg}      onChange={v => set("appearance_app_light_bg", v)} />
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-sm font-bold text-white">الوضع الليلي (Dark)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <ColorPicker label="اللون الرئيسي" value={s.appearance_app_dark_primary} onChange={v => set("appearance_app_dark_primary", v)} />
                    <ColorPicker label="لون النص"      value={s.appearance_app_dark_text}    onChange={v => set("appearance_app_dark_text", v)} />
                    <ColorPicker label="لون الخلفية"   value={s.appearance_app_dark_bg}      onChange={v => set("appearance_app_dark_bg", v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.03] px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/50">معاينة نهاري:</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md border" style={{ background: s.appearance_app_light_bg, borderColor: s.appearance_app_light_primary + "50" }} />
                        <div className="w-5 h-5 rounded-md" style={{ background: s.appearance_app_light_primary }} />
                        <div className="w-5 h-5 rounded-md border border-white/10" style={{ background: s.appearance_app_light_text }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/50">معاينة ليلي:&nbsp;</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md border" style={{ background: s.appearance_app_dark_bg, borderColor: s.appearance_app_dark_primary + "50" }} />
                        <div className="w-5 h-5 rounded-md" style={{ background: s.appearance_app_dark_primary }} />
                        <div className="w-5 h-5 rounded-md border border-white/10" style={{ background: s.appearance_app_dark_text }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ════ الشريط الإعلاني ════ */}
            <Section icon={<Megaphone className="w-3.5 h-3.5" />} title="الشريط الإعلاني" subtitle="Announcement Bar" color="#ec4899">
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm text-white font-medium">تفعيل الشريط</p>
                    <p className="text-xs text-white/35 mt-0.5">شريط في أعلى الموقع للإشعارات</p>
                  </div>
                  <button
                    onClick={() => set("appearance_announcement_on", s.appearance_announcement_on === "true" ? "false" : "true")}
                    className="text-sm font-bold px-4 py-2 rounded-xl transition-all"
                    style={s.appearance_announcement_on === "true"
                      ? { background: "#ec489920", color: "#ec4899" }
                      : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
                    }
                  >
                    {s.appearance_announcement_on === "true" ? "مفعّل" : "معطّل"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#ec4899aa]">نص الشريط</label>
                  <input
                    value={s.appearance_announcement_text}
                    onChange={e => set("appearance_announcement_text", e.target.value)}
                    placeholder="🔥 خصم 50% لفترة محدودة — سارع الآن!"
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none placeholder-white/20"
                  />
                </div>
                <ColorPicker
                  label="لون الشريط"
                  value={s.appearance_announcement_color}
                  onChange={v => set("appearance_announcement_color", v)}
                />
                {s.appearance_announcement_on === "true" && s.appearance_announcement_text && (
                  <div className="rounded-lg px-4 py-2 text-center text-sm font-bold" style={{ background: s.appearance_announcement_color, color: "#000" }}>
                    {s.appearance_announcement_text}
                  </div>
                )}
              </div>
            </Section>

          </div>
        )}

        {/* Sticky Save */}
        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-black shadow-2xl disabled:opacity-40"
            style={{ background: "var(--aa, #9fbcff)", boxShadow: "0 8px 32px rgba(159,188,255,0.3)" }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>

      </div>
    </AdminLayout>
  );
}
