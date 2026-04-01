import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Send, Bell, Loader2, RefreshCw, Trash2, Users, ChevronDown, Check,
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

interface NotifRecord {
  id: number;
  title: string;
  body: string;
  target: string;
  recipientCount: number;
  sentAt: string;
}

interface Group {
  id: number;
  certName: string;
  name: string;
  deviceCount?: number;
  activeCount?: number;
}

function parseTarget(target: string, groups: Group[]): { label: string; color: string } {
  if (target === "all" || !target) return { label: "الكل", color: A };
  if (target.startsWith("group:")) {
    const certName = target.replace("group:", "");
    const g = groups.find(g => g.certName === certName);
    return { label: g?.name || certName, color: "#a78bfa" };
  }
  return { label: target, color: A };
}

// ─── Target Dropdown ──────────────────────────────────────────────────────────
function TargetPicker({
  value, onChange, groups, loadingGroups,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: Group[];
  loadingGroups: boolean;
}) {
  const [open, setOpen] = useState(false);

  const currentLabel = value === "all"
    ? "جميع المشتركين"
    : groups.find(g => `group:${g.certName}` === value)?.name || value;

  const options: { value: string; label: string; sub?: string; icon?: "all" | "group" }[] = [
    { value: "all", label: "جميع المشتركين", sub: "كل المشتركين النشطين", icon: "all" },
    ...groups.map(g => ({
      value: `group:${g.certName}`,
      label: g.name || g.certName,
      sub: g.activeCount !== undefined ? `${g.activeCount} مشترك نشط` : g.certName,
      icon: "group" as const,
    })),
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-black border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white hover:border-white/20 focus:border-[#9fbcff]/50 focus:outline-none transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {value === "all" ? (
            <Users className="w-4 h-4 shrink-0" style={{ color: A }} />
          ) : (
            <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ background: "#a78bfa30" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#a78bfa" }} />
            </div>
          )}
          <span className="truncate">{loadingGroups ? "جاري التحميل..." : currentLabel}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            {options.map((opt, i) => (
              <div key={opt.value}>
                {i === 1 && groups.length > 0 && (
                  <div className="px-3 py-1.5 border-t border-white/5">
                    <span className="text-[10px] font-semibold text-white/25 tracking-wider uppercase">المجموعات</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-right"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: opt.icon === "all" ? `${A}15` : "#a78bfa15" }}>
                    {opt.icon === "all" ? (
                      <Users className="w-3.5 h-3.5" style={{ color: A }} />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#a78bfa" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm text-white font-medium truncate">{opt.label}</p>
                    {opt.sub && <p className="text-[11px] text-white/35 truncate">{opt.sub}</p>}
                  </div>
                  {value === opt.value && (
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: A }} />
                  )}
                </button>
              </div>
            ))}
            {groups.length === 0 && !loadingGroups && (
              <p className="text-center text-white/30 text-xs py-3">لا توجد مجموعات</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminNotifications() {
  usePageTitle("الإشعارات");
  const { toast } = useToast();
  const [history, setHistory] = useState<NotifRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", target: "all" });
  const [charCount, setCharCount] = useState(0);

  const fetchHistory = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/notifications");
    setHistory(d?.notifications || []);
    setLoading(false);
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    const d = await adminFetch("/admin/groups");
    setGroups(d?.groups || []);
    setLoadingGroups(false);
  };

  useEffect(() => {
    fetchHistory();
    fetchGroups();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    try {
      const d = await adminFetch("/admin/notifications", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (d?.success) {
        const targetLabel = form.target === "all"
          ? "جميع المشتركين"
          : groups.find(g => `group:${g.certName}` === form.target)?.name || form.target;
        toast({
          title: "تم إرسال الإشعار بنجاح",
          description: `${d.notification.recipientCount} مستلم — ${targetLabel}`,
        });
        setForm(f => ({ ...f, title: "", body: "" }));
        setCharCount(0);
        fetchHistory();
      } else {
        toast({ title: "فشل الإرسال", variant: "destructive" });
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
    setSending(false);
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/admin/notifications/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchHistory();
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString("ar-IQ", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">الإشعارات</h2>
            <p className="text-white/40 text-xs mt-0.5">إرسال إشعارات للمشتركين وعرض السجل</p>
          </div>
          <button
            onClick={() => { fetchHistory(); fetchGroups(); }}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
          {/* ── Send Form ────────────────────────────────────────────────── */}
          <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${A}20` }}>
                <Bell className="w-4 h-4" style={{ color: A }} />
              </div>
              <h3 className="text-sm font-bold text-white">إرسال إشعار جديد</h3>
            </div>

            <form onSubmit={handleSend} className="p-5 space-y-4">
              {/* Target Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>الفئة المستهدفة</label>
                <TargetPicker
                  value={form.target}
                  onChange={v => setForm(f => ({ ...f, target: v }))}
                  groups={groups}
                  loadingGroups={loadingGroups}
                />
                {form.target !== "all" && form.target.startsWith("group:") && (() => {
                  const g = groups.find(g => `group:${g.certName}` === form.target);
                  return g ? (
                    <p className="text-[11px] text-white/30 flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#a78bfa" }} />
                      سيتم الإرسال فقط لأجهزة مجموعة &quot;{g.name}&quot;
                      {g.activeCount !== undefined && ` (${g.activeCount} مشترك نشط)`}
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>عنوان الإشعار</label>
                <input
                  required
                  maxLength={80}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="مثال: تحديث جديد متاح!"
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20"
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: `${A}99` }}>نص الإشعار</label>
                  <span className="text-xs text-white/25">{charCount}/200</span>
                </div>
                <textarea
                  required
                  maxLength={200}
                  value={form.body}
                  onChange={e => {
                    setForm(f => ({ ...f, body: e.target.value }));
                    setCharCount(e.target.value.length);
                  }}
                  placeholder="نص الإشعار الذي سيصل للمشتركين..."
                  rows={4}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white h-28 resize-none focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20"
                />
              </div>

              <button
                type="submit"
                disabled={sending || !form.title.trim() || !form.body.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 transition-all"
                style={{ background: A }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "جاري الإرسال..." : "إرسال الإشعار"}
              </button>
            </form>
          </div>

          {/* ── History ──────────────────────────────────────────────────── */}
          <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="text-sm font-bold text-white">سجل الإشعارات</h3>
              <span className="text-xs text-white/30">{history.length} إشعار</span>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${A}10` }}>
                  <Bell className="w-6 h-6" style={{ color: `${A}50` }} />
                </div>
                <p className="text-white/30 text-sm">لا يوجد إشعارات مرسلة بعد</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[480px]">
                {history.map(notif => {
                  const tgt = parseTarget(notif.target, groups);
                  return (
                    <div key={notif.id} className="px-5 py-3.5 group hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-white font-semibold text-sm truncate">{notif.title}</p>
                            <span
                              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: `${tgt.color}15`, color: tgt.color }}
                            >
                              {notif.target === "all" ? (
                                <Users className="w-2.5 h-2.5" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: tgt.color }} />
                              )}
                              {tgt.label}
                            </span>
                          </div>
                          <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{notif.body}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-white/25 text-[10px]">{formatDate(notif.sentAt)}</span>
                            <span className="text-white/25 text-[10px]">·</span>
                            <span className="text-[10px]" style={{ color: `${A}70` }}>
                              {notif.recipientCount} مستلم
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
