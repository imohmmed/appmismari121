import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  Shield, Radio, Eye, EyeOff, RefreshCw, Loader2, Save,
  AlertTriangle, Wifi, WifiOff, Zap, ToggleLeft, ChevronDown,
  ChevronUp, Trash2, BarChart3, Clock, Smartphone, Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const A   = "#9fbcff";
const RED = "#ef4444";
const ORG = "#f59e0b";
const GRN = "#22c55e";

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: {
      ...(opts?.headers || {}),
      "x-admin-token": token,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 204) return null;
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface DylibEvent {
  id: number;
  eventType: string;
  subType: string;
  ip: string;
  userAgent: string;
  bundleId: string;
  appVersion: string;
  extra: string;
  createdAt: string;
}

interface TelemetryData {
  events: DylibEvent[];
  stats: Record<string, number>;
  last7Days: { day: string; eventType: string; count: number }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}ث`;
  if (diff < 3600) return `${Math.floor(diff / 60)}د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}س`;
  return `${Math.floor(diff / 86400)}ي`;
}

function typeLabel(t: string) {
  const m: Record<string, string> = {
    spy:            "تجسس",
    vpn:            "VPN",
    safe_mode:      "وضع أمان",
    integrity_fail: "فشل نزاهة",
    unknown:        "غير معروف",
  };
  return m[t] ?? t;
}

function typeColor(t: string) {
  const m: Record<string, string> = {
    spy:            RED,
    vpn:            ORG,
    safe_mode:      "#a855f7",
    integrity_fail: "#ec4899",
    unknown:        "#6b7280",
  };
  return m[t] ?? "#6b7280";
}

function typeIcon(t: string) {
  if (t === "spy")            return <Eye className="w-3 h-3" />;
  if (t === "vpn")            return <Wifi className="w-3 h-3" />;
  if (t === "safe_mode")      return <Shield className="w-3 h-3" />;
  if (t === "integrity_fail") return <AlertTriangle className="w-3 h-3" />;
  return <Radio className="w-3 h-3" />;
}

// ─── StatCard ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-1.5" style={{ borderColor: `${color}25`, background: `${color}08` }}>
      <div className="flex items-center gap-2 text-xs" style={{ color: `${color}99` }}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-black" style={{ color, fontFamily: "Outfit" }}>{value}</p>
    </div>
  );
}

// ─── ToggleRow ─────────────────────────────────────────────────────────────
function ToggleRow({
  label, labelEn, description, value, onChange, color, warning,
}: {
  label: string; labelEn: string; description: string;
  value: boolean; onChange: (v: boolean) => void;
  color: string; warning?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{label}</span>
            <span className="text-[10px] text-white/30">{labelEn}</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{description}</p>
          {warning && value && (
            <p className="text-xs mt-1 flex items-start gap-1.5" style={{ color: RED }}>
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {warning}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="flex items-center gap-2 py-1 transition-all shrink-0"
        >
          <div
            className="w-11 h-6 rounded-full relative transition-all duration-200"
            style={{ background: value ? color : "rgba(255,255,255,0.08)" }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: value ? "calc(100% - 20px)" : "4px" }}
            />
          </div>
          <span className="text-xs w-12 text-right" style={{ color: value ? color : "rgba(255,255,255,0.3)" }}>
            {value ? "مفعّل" : "معطّل"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── SectionHeader ─────────────────────────────────────────────────────────
function SectionHeader({
  icon, label, labelEn, color, children,
}: {
  icon: React.ReactNode; label: string; labelEn: string; color: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">{label}</h3>
          <p className="text-[10px] text-white/30">{labelEn}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// الجزء الأول: رادار المراقبة
// ═══════════════════════════════════════════════════════════════════════════
function MonitoringSection({ telemetry, loading, onRefresh, onClear }: {
  telemetry: TelemetryData | null;
  loading: boolean;
  onRefresh: () => void;
  onClear: () => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(true);

  const stats = telemetry?.stats ?? {};
  const events = (telemetry?.events ?? []).filter(e => filter === "all" || e.eventType === filter);
  const totalSpy = stats["spy"] ?? 0;
  const totalVpn = stats["vpn"] ?? 0;
  const totalSafeMode = stats["safe_mode"] ?? 0;
  const totalIntegrity = stats["integrity_fail"] ?? 0;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${RED}25`, background: `${RED}05` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors border-b border-white/5"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${RED}20` }}>
          <Radio className="w-4 h-4" style={{ color: RED }} />
        </div>
        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-white">رادار المراقبة</span>
          <span className="text-white/30 text-xs mr-2">Monitoring Radar</span>
        </div>
        {totalSpy > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse" style={{ background: `${RED}20`, color: RED }}>
            {totalSpy} تجسس
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="p-5 space-y-5">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="محاولات تجسس" value={totalSpy} color={RED} icon={<Eye className="w-3.5 h-3.5" />} />
            <StatCard label="أجهزة VPN" value={totalVpn} color={ORG} icon={<Wifi className="w-3.5 h-3.5" />} />
            <StatCard label="وضع أمان" value={totalSafeMode} color="#a855f7" icon={<Shield className="w-3.5 h-3.5" />} />
            <StatCard label="فشل نزاهة" value={totalIntegrity} color="#ec4899" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
          </div>

          {/* شرح سريع */}
          <div className="rounded-xl p-3 text-xs text-white/40 leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="font-bold text-white/60 mb-1">كيف تُقرأ هذه البيانات؟</p>
            <p><span style={{ color: RED }}>تجسس (Spy):</span> يتم حظر هؤلاء في الـ Keychain للجهاز لضمان عدم عودتهم. مصدره: Charles/Proxyman على منفذ محلي.</p>
            <p className="mt-1"><span style={{ color: ORG }}>VPN:</span> لا يُحظر — فقط تُسجَّل. مصدره: proxy بعيد أو VPN شرعي.</p>
            <p className="mt-1"><span style={{ color: "#a855f7" }}>وضع أمان:</span> جهاز دخل Safe Mode بسبب 3+ crashes متتالية. يحتاج متابعة.</p>
            <p className="mt-1"><span style={{ color: "#ec4899" }}>فشل نزاهة:</span> Frida أو Sideloadly مكتشَف — الـ Hooks مُعطَّلة تلقائياً على الجهاز.</p>
          </div>

          {/* فلتر + أزرار */}
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "spy", "vpn", "safe_mode", "integrity_fail"].map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                style={filter === t
                  ? { background: t === "all" ? A : typeColor(t), color: "#000" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }
                }
              >
                {t === "all" ? "الكل" : typeLabel(t)}
                {t !== "all" && stats[t] ? ` (${stats[t]})` : ""}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={onRefresh} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {(telemetry?.events?.length ?? 0) > 0 && (
              <button
                onClick={onClear}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1"
                style={{ background: `${RED}15`, color: RED }}
              >
                <Trash2 className="w-3 h-3" />مسح الكل
              </button>
            )}
          </div>

          {/* جدول الأحداث */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : events.length === 0 ? (
            <div className="text-center py-10 text-white/20 text-sm">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              لا توجد أحداث مسجَّلة
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {events.map(ev => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.02]"
                  style={{ background: `${typeColor(ev.eventType)}06`, border: `1px solid ${typeColor(ev.eventType)}15` }}
                >
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${typeColor(ev.eventType)}20` }}>
                    <span style={{ color: typeColor(ev.eventType) }}>{typeIcon(ev.eventType)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: typeColor(ev.eventType) }}>{typeLabel(ev.eventType)}</span>
                      {ev.subType && <span className="text-[10px] text-white/30">{ev.subType}</span>}
                      {ev.ip && <span className="text-[10px] font-mono text-white/40" dir="ltr">{ev.ip}</span>}
                      {ev.appVersion && <span className="text-[10px] text-white/25">v{ev.appVersion}</span>}
                    </div>
                    {ev.userAgent && (
                      <p className="text-[10px] text-white/20 truncate mt-0.5">{ev.userAgent}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/25 shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{relTime(ev.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// الجزء الثاني: التحكم في الإصدارات
// ═══════════════════════════════════════════════════════════════════════════
function VersionControlSection({
  settings, onChange, onSave, saving,
}: {
  settings: Record<string, string>;
  onChange: (k: string, v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(true);
  const isForce = settings["force_update"] === "true";

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${A}25`, background: `${A}05` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors border-b border-white/5"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${A}20` }}>
          <BarChart3 className="w-4 h-4" style={{ color: A }} />
        </div>
        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-white">التحكم في الإصدارات</span>
          <span className="text-white/30 text-xs mr-2">Version Control</span>
        </div>
        {isForce && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${RED}20`, color: RED }}>
            🔨 إجباري
          </span>
        )}
        {settings["store_version"] && (
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${A}15`, color: A }}>
            v{settings["store_version"]}
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="p-5 space-y-5">
          {/* ── مدير التحديثات */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5" style={{ color: A }} />
              <span className="text-xs font-bold" style={{ color: A }}>مدير التحديثات</span>
              <span className="text-[10px] text-white/25">Update Manager · Module 7 + 8</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${A}aa` }}>رقم الإصدار</label>
                <input
                  type="text"
                  value={settings["store_version"] || ""}
                  onChange={e => onChange("store_version", e.target.value)}
                  placeholder="2.5.0"
                  dir="ltr"
                  className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-sm text-white font-mono focus:outline-none placeholder-white/20 focus:border-white/20"
                  style={settings["store_version"] ? { borderColor: `${A}30` } : {}}
                />
                <p className="text-[11px] text-white/25">
                  يُقارَن بـ CFBundleShortVersionString في الجهاز — يدعم "2.5" = "2.5.0"
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${A}aa` }}>الإصدار الأدنى المدعوم</label>
                <input
                  type="text"
                  value={settings["min_version"] || ""}
                  onChange={e => onChange("min_version", e.target.value)}
                  placeholder="1.0"
                  dir="ltr"
                  className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-sm text-white font-mono focus:outline-none placeholder-white/20 focus:border-white/20"
                  style={settings["min_version"] ? { borderColor: `${A}30` } : {}}
                />
                <p className="text-[11px] text-white/25">أقل من هذا الإصدار = لا يعمل المتجر</p>
              </div>
            </div>

            <div className="space-y-1.5 mb-3">
              <label className="text-xs font-medium" style={{ color: `${A}aa` }}>ملاحظات الإصدار (تظهر في Alert التحديث)</label>
              <textarea
                rows={3}
                value={settings["store_notes"] || ""}
                onChange={e => onChange("store_notes", e.target.value)}
                placeholder="تم إصلاح مشكلة الاتصال وتحسين سرعة التحميل..."
                dir="rtl"
                className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-sm text-white resize-none focus:outline-none placeholder-white/20 focus:border-white/20"
                style={settings["store_notes"] ? { borderColor: `${A}30` } : {}}
              />
            </div>

            {/* Force Update */}
            <div className="rounded-xl p-4 border" style={{ background: `${RED}05`, borderColor: `${RED}20` }}>
              <ToggleRow
                label="Force Update (المطرقة)"
                labelEn="Force Update"
                description="عند التفعيل: زر 'لاحقاً' في Alert التحديث يُغلق التطبيق تماماً بدل تأجيله. يؤثر فقط على الأجهزة بإصدار أقل من رقم الإصدار أعلاه."
                value={isForce}
                onChange={v => onChange("force_update", v ? "true" : "false")}
                color={RED}
                warning="تفعيل هذا الخيار سيمنع أصحاب النسخ القديمة من فتح المتجر تماماً حتى يحدّثوا."
              />
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* ── رسالة الترحيب الديناميكية */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-3.5 h-3.5" style={{ color: GRN }} />
              <span className="text-xs font-bold" style={{ color: GRN }}>رسالة الترحيب الديناميكية</span>
              <span className="text-[10px] text-white/25">Welcome Message · Module 12</span>
            </div>
            <div className="space-y-1.5">
              <textarea
                rows={3}
                value={settings["welcome_message"] || ""}
                onChange={e => onChange("welcome_message", e.target.value)}
                placeholder="أهلاً بك في مسماري+ ! تم تحديث شهادات التطبيقات بنجاح."
                dir="rtl"
                className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-sm text-white resize-none focus:outline-none placeholder-white/20 focus:border-white/20"
                style={settings["welcome_message"] ? { borderColor: `${GRN}30` } : {}}
              />
              <p className="text-[11px] text-white/25">
                تظهر عند أول تشغيل بعد كل إصدار جديد. اتركها فارغة = لا تظهر رسالة.
              </p>
            </div>
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-40 w-full justify-center"
            style={{ background: A }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "جاري الحفظ..." : "حفظ إعدادات الإصدار"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// الجزء الثالث: إعدادات الزر النووي
// ═══════════════════════════════════════════════════════════════════════════
function SystemTogglesSection({
  settings, onChange, onSave, saving,
}: {
  settings: Record<string, string>;
  onChange: (k: string, v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(true);
  const isMaintenance = settings["maintenance_mode"] === "true";
  const isKillSwitch  = settings["disable_hooks"] === "true";

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${ORG}25`, background: `${ORG}05` }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors border-b border-white/5"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ORG}20` }}>
          <ToggleLeft className="w-4 h-4" style={{ color: ORG }} />
        </div>
        <div className="flex-1 text-right">
          <span className="text-sm font-bold text-white">إعدادات الزر النووي</span>
          <span className="text-white/30 text-xs mr-2">System Toggles</span>
        </div>
        {(isMaintenance || isKillSwitch) && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse" style={{ background: `${ORG}20`, color: ORG }}>
            ⚠ نشط
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="p-5 space-y-4">
          <div className="rounded-xl p-3 text-xs text-white/40 leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            هذه الأزرار تؤثر على <strong className="text-white/60">جميع المستخدمين فوراً</strong> دون الحاجة لتحديث الدايلب — لأنها تُقرأ من الـ Payload المشفَّر عند كل فتح للتطبيق.
          </div>

          {/* وضع الصيانة */}
          <div className="rounded-xl p-4 border" style={{ background: `${ORG}05`, borderColor: `${ORG}20` }}>
            <div className="flex items-center gap-2 mb-3">
              <WifiOff className="w-3.5 h-3.5" style={{ color: ORG }} />
              <span className="text-xs font-bold" style={{ color: ORG }}>وضع الصيانة</span>
              <span className="text-[10px] text-white/25">Maintenance Mode · Module 7</span>
            </div>
            <ToggleRow
              label="إغلاق المتجر للصيانة"
              labelEn="Maintenance Mode"
              description="عند التفعيل: يظهر Alert 'نحن في صيانة' ويمنع أي استخدام للمتجر. مفيد عند تحديث السيرفر أو الشهادات."
              value={isMaintenance}
              onChange={v => onChange("maintenance_mode", v ? "true" : "false")}
              color={ORG}
              warning="المتجر محجوب الآن لجميع المستخدمين."
            />
            {isMaintenance && (
              <div className="mt-3 space-y-1.5">
                <label className="text-xs font-medium text-white/50">رسالة الصيانة</label>
                <textarea
                  rows={2}
                  value={settings["maintenance_message"] || ""}
                  onChange={e => onChange("maintenance_message", e.target.value)}
                  placeholder="المتجر في وضع الصيانة حالياً، يرجى المحاولة لاحقاً"
                  dir="rtl"
                  className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-sm text-white resize-none focus:outline-none placeholder-white/20 focus:border-white/20"
                  style={{ borderColor: `${ORG}30` }}
                />
              </div>
            )}
          </div>

          {/* Kill-Switch */}
          <div className="rounded-xl p-4 border" style={{ background: `${RED}05`, borderColor: `${RED}20` }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: RED }} />
              <span className="text-xs font-bold" style={{ color: RED }}>تعطيل الحماية مؤقتاً</span>
              <span className="text-[10px] text-white/25">Kill-Switch · disableHooks</span>
            </div>
            <ToggleRow
              label="إيقاف طارئ للـ Hooks"
              labelEn="Kill-Switch"
              description="يُرسل السيرفر disableHooks: true في الـ Payload المشفَّر — يجعل المتجر يعمل بدون أي Hook (JB Bypass، Bundle Mask، NSFileManager Protection). لحالات الطوارئ فقط."
              value={isKillSwitch}
              onChange={v => onChange("disable_hooks", v ? "true" : "false")}
              color={RED}
              warning="الحماية مُعطَّلة حالياً! أدوات الكشف عن الجيلبريك ستعمل بشكل طبيعي."
            />
          </div>

          {/* بطاقة حالة الـ Payload */}
          <div className="rounded-xl p-3 text-xs font-mono leading-relaxed" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/30 mb-2 font-sans font-bold text-[11px]">Payload المُرسَل للدايلب الآن (بعد AES decrypt):</p>
            <p style={{ color: A }}>{"{"}</p>
            <p className="pr-4">
              <span className="text-white/40">storeVersion:</span>{" "}
              <span style={{ color: GRN }}>"{settings["store_version"] || "1.0"}"</span>
            </p>
            <p className="pr-4">
              <span className="text-white/40">isForceUpdate:</span>{" "}
              <span style={{ color: settings["force_update"] === "true" ? RED : GRN }}>
                {settings["force_update"] === "true" ? "true" : "false"}
              </span>
            </p>
            <p className="pr-4">
              <span className="text-white/40">isMaintenanceMode:</span>{" "}
              <span style={{ color: settings["maintenance_mode"] === "true" ? ORG : GRN }}>
                {settings["maintenance_mode"] === "true" ? "true" : "false"}
              </span>
            </p>
            <p className="pr-4">
              <span className="text-white/40">disableHooks:</span>{" "}
              <span style={{ color: settings["disable_hooks"] === "true" ? RED : GRN }}>
                {settings["disable_hooks"] === "true" ? "true" : "false"}
              </span>
            </p>
            <p className="pr-4">
              <span className="text-white/40">welcomeMessage:</span>{" "}
              <span style={{ color: A }}>"{settings["welcome_message"] ? settings["welcome_message"].slice(0, 30) + "..." : ""}"</span>
            </p>
            <p style={{ color: A }}>{"}"}</p>
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-40 w-full justify-center"
            style={{ background: ORG }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "جاري الحفظ..." : "حفظ إعدادات النظام"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════════════════════════════════════════
export default function AdminSecurity() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);
  const [savingVersion, setSavingVersion]   = useState(false);
  const [savingToggles, setSavingToggles]   = useState(false);

  // ─── جلب الإعدادات
  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const d = await adminFetch("/admin/settings");
      const map: Record<string, string> = {};
      for (const s of d?.settings || []) map[s.key] = s.value;
      setSettings(map);
    } catch { /* ignore */ }
    setLoadingSettings(false);
  }, []);

  // ─── جلب بيانات التيليمتري
  const fetchTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    try {
      const d = await adminFetch("/admin/security/telemetry");
      setTelemetry(d);
    } catch { /* ignore */ }
    setLoadingTelemetry(false);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchTelemetry();
  }, [fetchSettings, fetchTelemetry]);

  const handleChange = (key: string, val: string) => {
    setSettings(s => ({ ...s, [key]: val }));
  };

  // ─── حفظ إعدادات الإصدار
  const saveVersion = async () => {
    setSavingVersion(true);
    try {
      await adminFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: [
            { key: "store_version",   value: settings["store_version"]   || "" },
            { key: "min_version",     value: settings["min_version"]     || "" },
            { key: "store_notes",     value: settings["store_notes"]     || "" },
            { key: "force_update",    value: settings["force_update"]    || "false" },
            { key: "welcome_message", value: settings["welcome_message"] || "" },
          ],
        }),
      });
      toast({ title: "✅ تم حفظ إعدادات الإصدار" });
    } catch {
      toast({ title: "❌ فشل الحفظ", variant: "destructive" });
    }
    setSavingVersion(false);
  };

  // ─── حفظ إعدادات النظام
  const saveToggles = async () => {
    setSavingToggles(true);
    try {
      await adminFetch("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: [
            { key: "maintenance_mode",    value: settings["maintenance_mode"]    || "false" },
            { key: "maintenance_message", value: settings["maintenance_message"] || "" },
            { key: "disable_hooks",       value: settings["disable_hooks"]       || "false" },
          ],
        }),
      });
      toast({ title: "✅ تم حفظ إعدادات النظام" });
    } catch {
      toast({ title: "❌ فشل الحفظ", variant: "destructive" });
    }
    setSavingToggles(false);
  };

  // ─── مسح التيليمتري
  const clearTelemetry = async () => {
    if (!confirm("هل أنت متأكد من مسح جميع سجلات الأمان؟")) return;
    try {
      await adminFetch("/admin/security/telemetry", { method: "DELETE" });
      setTelemetry(prev => prev ? { ...prev, events: [], stats: {}, last7Days: [] } : null);
      toast({ title: "تم مسح سجلات الأمان" });
    } catch {
      toast({ title: "❌ فشل المسح", variant: "destructive" });
    }
  };

  // ─── إحصائية سريعة للـ header
  const totalEvents = Object.values(telemetry?.stats ?? {}).reduce((a, b) => a + b, 0);
  const spyCount    = telemetry?.stats?.["spy"] ?? 0;

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-2xl" dir="rtl">
        {/* ── Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">الحماية</h2>
              {spyCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold animate-pulse" style={{ background: `${RED}20`, color: RED }}>
                  {spyCount} تجسس
                </span>
              )}
            </div>
            <p className="text-white/40 text-xs mt-0.5">مراقبة الأمان · التحكم في الإصدارات · إعدادات الطوارئ</p>
          </div>
          <button onClick={() => { fetchSettings(); fetchTelemetry(); }} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* بطاقات المؤشرات العلوية */}
        {!loadingSettings && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#111] rounded-xl border border-white/8 p-3 text-center">
              <p className="text-xl font-black" style={{ fontFamily: "Outfit", color: A }}>{totalEvents}</p>
              <p className="text-white/40 text-xs mt-0.5">إجمالي الأحداث</p>
            </div>
            <div className="bg-[#111] rounded-xl border border-white/8 p-3 text-center">
              <p className="text-xl font-black" style={{ fontFamily: "Outfit", color: settings["maintenance_mode"] === "true" ? ORG : GRN }}>
                {settings["maintenance_mode"] === "true" ? "⚠" : "✓"}
              </p>
              <p className="text-white/40 text-xs mt-0.5">حالة المتجر</p>
            </div>
            <div className="bg-[#111] rounded-xl border border-white/8 p-3 text-center">
              <p className="text-xl font-black" style={{ fontFamily: "Outfit", color: settings["disable_hooks"] === "true" ? RED : GRN }}>
                {settings["disable_hooks"] === "true" ? "OFF" : "ON"}
              </p>
              <p className="text-white/40 text-xs mt-0.5">الحماية</p>
            </div>
          </div>
        )}

        {loadingSettings ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <>
            {/* ═══ الجزء 1: رادار المراقبة */}
            <MonitoringSection
              telemetry={telemetry}
              loading={loadingTelemetry}
              onRefresh={fetchTelemetry}
              onClear={clearTelemetry}
            />

            {/* ═══ الجزء 2: التحكم في الإصدارات */}
            <VersionControlSection
              settings={settings}
              onChange={handleChange}
              onSave={saveVersion}
              saving={savingVersion}
            />

            {/* ═══ الجزء 3: الزر النووي */}
            <SystemTogglesSection
              settings={settings}
              onChange={handleChange}
              onSave={saveToggles}
              saving={savingToggles}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
