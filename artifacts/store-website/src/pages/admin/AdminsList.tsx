import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Shield, ShieldCheck, X, Check, Loader2, KeyRound, UserX } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const ACCENT = "#9fbcff";

const ALL_PERMISSIONS = [
  { key: "apps",          label: "التطبيقات" },
  { key: "categories",    label: "الأقسام" },
  { key: "subscribers",   label: "المشتركين" },
  { key: "groups",        label: "المجموعات" },
  { key: "packages",      label: "الباقات" },
  { key: "featured",      label: "المميّز" },
  { key: "settings",      label: "الإعدادات" },
  { key: "notifications", label: "الإشعارات" },
  { key: "requests",      label: "الطلبات" },
  { key: "admins",        label: "الأدمنية" },
];

interface Admin {
  id: number;
  username: string;
  email: string;
  role: string;
  permissions: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AdminForm {
  username: string;
  email: string;
  password: string;
  role: "admin" | "superadmin";
  permissions: string[];
  isActive: boolean;
}

const defaultForm = (): AdminForm => ({
  username: "", email: "", password: "", role: "admin", permissions: [], isActive: true,
});

function adminFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("adminToken") || "";
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-token": token, ...opts.headers },
  });
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium block mb-1" style={{ color: `${ACCENT}99` }}>{children}</label>;
}

function FieldInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-black border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-[#9fbcff]/50 transition-all placeholder-white/20"
    />
  );
}

export default function AdminsList() {
  usePageTitle("المشرفون");
  const { toast } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AdminForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const selfUsername = localStorage.getItem("adminUsername") || "";
  const selfRole = localStorage.getItem("adminRole") || "";

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`${API}/api/admin/admins`);
      if (res.status === 403) {
        toast({ title: "هذه الصفحة للمسؤول الأعلى فقط", variant: "destructive" });
        setLoading(false); return;
      }
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch {
      toast({ title: "فشل تحميل قائمة المسؤولين", variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(defaultForm()); setEditId(null); setShowModal(true); };
  const openEdit = (a: Admin) => {
    setForm({
      username: a.username,
      email: a.email,
      password: "",
      role: a.role as any,
      permissions: JSON.parse(a.permissions || "[]"),
      isActive: a.isActive,
    });
    setEditId(a.id);
    setShowModal(true);
  };

  const togglePerm = (key: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }));
  };

  const selectAllPerms = () => setForm(f => ({ ...f, permissions: ALL_PERMISSIONS.map(p => p.key) }));
  const clearAllPerms  = () => setForm(f => ({ ...f, permissions: [] }));

  const handleSave = async () => {
    if (!editId && (!form.username.trim() || !form.password.trim())) {
      toast({ title: "اسم المستخدم وكلمة المرور مطلوبان", variant: "destructive" }); return;
    }
    if (!editId && form.password.length < 8) {
      toast({ title: "كلمة المرور: 8 أحرف على الأقل", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body: any = { email: form.email, role: form.role, permissions: form.permissions, isActive: form.isActive };
      if (!editId) { body.username = form.username; body.password = form.password; }
      else if (form.password.trim()) { body.password = form.password; }

      const url    = editId ? `${API}/api/admin/admins/${editId}` : `${API}/api/admin/admins`;
      const method = editId ? "PUT" : "POST";
      const res    = await adminFetch(url, { method, body: JSON.stringify(body) });
      const data   = await res.json();

      if (!res.ok) { toast({ title: data.error || "فشل الحفظ", variant: "destructive" }); return; }
      toast({ title: editId ? "تم تحديث المسؤول" : "تمت إضافة المسؤول بنجاح" });
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      const res  = await adminFetch(`${API}/api/admin/admins/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error || "فشل الحذف", variant: "destructive" }); return; }
      toast({ title: "تم حذف المسؤول" });
      setDeleteId(null);
      load();
    } catch { toast({ title: "خطأ في الحذف", variant: "destructive" }); }
  };

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">الأدمنية</h2>
            <p className="text-xs text-white/30 mt-0.5">إدارة المسؤولين وصلاحياتهم</p>
          </div>
          {selfRole === "superadmin" && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-black transition-all"
              style={{ background: ACCENT }}
            >
              <Plus className="w-3.5 h-3.5" /> إضافة مسؤول
            </button>
          )}
        </div>

        {selfRole !== "superadmin" ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT}15` }}>
              <Shield className="w-7 h-7" style={{ color: ACCENT }} />
            </div>
            <div className="text-center">
              <p className="text-white font-bold">صلاحيات مقيّدة</p>
              <p className="text-white/40 text-sm mt-1">هذه الصفحة متاحة للمسؤول الأعلى (superadmin) فقط</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
          </div>
        ) : (
          <div className="space-y-3">
            {admins.length === 0 ? (
              <div className="bg-[#111] border border-white/5 rounded-2xl py-16 text-center text-white/30 text-sm">
                لا يوجد مسؤولون مضافون بعد
              </div>
            ) : (
              admins.map(admin => {
                const perms: string[]  = JSON.parse(admin.permissions || "[]");
                const isSuperadmin     = admin.role === "superadmin";
                const isSelf           = admin.username === selfUsername;

                return (
                  <div
                    key={admin.id}
                    className="bg-[#111] border border-white/8 rounded-2xl p-4 flex items-start gap-4"
                  >
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: isSuperadmin ? `${ACCENT}20` : "rgba(255,255,255,0.05)" }}
                    >
                      {isSuperadmin
                        ? <ShieldCheck className="w-5 h-5" style={{ color: ACCENT }} />
                        : <Shield className="w-5 h-5 text-white/35" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{admin.username}</span>
                        {isSelf && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}15`, color: ACCENT }}>
                            أنت
                          </span>
                        )}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={isSuperadmin
                            ? { background: `${ACCENT}15`, color: ACCENT }
                            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                        >
                          {isSuperadmin ? "مسؤول أعلى" : "مسؤول"}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${admin.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}
                        >
                          {admin.isActive ? "نشط" : "موقوف"}
                        </span>
                      </div>

                      {admin.email && (
                        <p className="text-white/35 text-xs mt-0.5" dir="ltr">{admin.email}</p>
                      )}

                      {/* Permissions */}
                      {!isSuperadmin && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {perms.length > 0 ? (
                            perms.map(p => {
                              const label = ALL_PERMISSIONS.find(x => x.key === p)?.label || p;
                              return (
                                <span key={p} className="text-xs px-1.5 py-0.5 bg-white/5 text-white/40 rounded-md">{label}</span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-white/20 italic">بدون صلاحيات محددة</span>
                          )}
                        </div>
                      )}

                      {admin.lastLoginAt && (
                        <p className="text-white/20 text-xs mt-1.5">
                          آخر دخول: {new Date(admin.lastLoginAt).toLocaleString("ar-IQ")}
                        </p>
                      )}
                      {!admin.lastLoginAt && (
                        <p className="text-white/15 text-xs mt-1.5">لم يسجّل دخولاً بعد</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(admin)}
                        title="تعديل"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-white/50" />
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => setDeleteId(admin.id)}
                          title="حذف"
                          className="p-2 rounded-xl bg-red-500/8 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${ACCENT}15` }}>
                  {editId ? <KeyRound className="w-4 h-4" style={{ color: ACCENT }} /> : <Plus className="w-4 h-4" style={{ color: ACCENT }} />}
                </div>
                <h2 className="font-bold text-white text-sm">{editId ? "تعديل مسؤول" : "إضافة مسؤول جديد"}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!editId && (
                <div>
                  <FieldLabel>اسم المستخدم *</FieldLabel>
                  <FieldInput
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    dir="ltr"
                    placeholder="username"
                    autoFocus
                  />
                </div>
              )}

              <div>
                <FieldLabel>البريد الإلكتروني</FieldLabel>
                <FieldInput
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  dir="ltr"
                  type="email"
                  placeholder="admin@mismari.com"
                />
              </div>

              <div>
                <FieldLabel>
                  {editId ? "كلمة مرور جديدة (اتركها فارغة للإبقاء)" : "كلمة المرور * (8 أحرف على الأقل)"}
                </FieldLabel>
                <FieldInput
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  type="password"
                  dir="ltr"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <FieldLabel>الدور</FieldLabel>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                  className="w-full bg-black border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-[#9fbcff]/50 transition-all"
                >
                  <option value="admin">مسؤول (admin)</option>
                  <option value="superadmin">مسؤول أعلى (superadmin)</option>
                </select>
              </div>

              {form.role !== "superadmin" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <FieldLabel>الصلاحيات</FieldLabel>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPerms} className="text-xs px-2 py-0.5 rounded-md text-white/40 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
                        تحديد الكل
                      </button>
                      <button type="button" onClick={clearAllPerms} className="text-xs px-2 py-0.5 rounded-md text-white/40 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
                        إلغاء الكل
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PERMISSIONS.map(p => {
                      const active = form.permissions.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePerm(p.key)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all text-right"
                          style={active
                            ? { background: `${ACCENT}15`, borderColor: `${ACCENT}40`, color: ACCENT }
                            : { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-colors"
                            style={active ? { background: ACCENT } : { background: "rgba(255,255,255,0.1)" }}
                          >
                            {active && <Check className="w-2.5 h-2.5 text-black" />}
                          </div>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className="w-10 h-6 rounded-full transition-all relative shrink-0"
                  style={{ background: form.isActive ? ACCENT : "rgba(255,255,255,0.15)" }}
                >
                  <div
                    className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
                    style={{ [form.isActive ? "right" : "left"]: "4px" }}
                  />
                </button>
                <span className="text-sm text-white/60">{form.isActive ? "حساب نشط" : "حساب موقوف"}</span>
              </div>
            </div>

            <div className="border-t border-white/5 p-4 flex gap-3 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white hover:bg-white/5 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                style={{ background: ACCENT }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-red-500/15 rounded-2xl flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">حذف المسؤول</h3>
              <p className="text-white/40 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white hover:bg-white/5 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
