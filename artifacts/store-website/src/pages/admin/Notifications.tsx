import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Send, Bell, Loader2, RefreshCw, Trash2, Users, X } from "lucide-react";
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

interface Notification {
  id: number;
  title: string;
  body: string;
  target: string;
  recipientCount: number;
  sentAt: string;
}

const TARGET_OPTIONS = [
  { value: "all", label: "جميع المشتركين" },
];

export default function AdminNotifications() {
  const { toast } = useToast();
  const [history, setHistory] = useState<Notification[]>([]);
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

  useEffect(() => { fetchHistory(); }, []);

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
        toast({ title: "تم إرسال الإشعار بنجاح", description: `${d.notification.recipientCount} مستلم` });
        setForm({ title: "", body: "", target: "all" });
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
    return date.toLocaleString("ar-IQ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">الإشعارات</h2>
            <p className="text-white/40 text-xs mt-0.5">إرسال إشعارات للمشتركين وعرض السجل</p>
          </div>
          <button onClick={fetchHistory} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
          <div className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${A}20` }}>
                <Bell className="w-4 h-4" style={{ color: A }} />
              </div>
              <h3 className="text-sm font-bold text-white">إرسال إشعار جديد</h3>
            </div>

            <form onSubmit={handleSend} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>الفئة المستهدفة</label>
                <select
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none appearance-none"
                >
                  {TARGET_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

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
              <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[420px]">
                {history.map(notif => (
                  <div key={notif.id} className="px-5 py-3.5 group hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-semibold text-sm truncate">{notif.title}</p>
                          {notif.target === "all" && (
                            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: `${A}15`, color: A }}>
                              <Users className="w-2.5 h-2.5" /> الكل
                            </span>
                          )}
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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
