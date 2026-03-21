import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, Trash2, Edit2, X, Loader2, Eye, EyeOff, Link2, Image as ImageIcon } from "lucide-react";
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

interface Banner {
  id: number;
  title: string;
  description: string | null;
  image: string | null;
  link: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const blankBanner = { title: "", description: "", image: "", link: "", isActive: true };

export default function AdminFeatured() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState(blankBanner);
  const [saving, setSaving] = useState(false);

  const fetchBanners = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/featured");
    setBanners(d?.banners || []);
    setLoading(false);
  };
  useEffect(() => { fetchBanners(); }, []);

  const openAdd = () => { setForm(blankBanner); setEditBanner(null); setModal("add"); };
  const openEdit = (b: Banner) => {
    setForm({ title: b.title, description: b.description || "", image: b.image || "", link: b.link || "", isActive: b.isActive });
    setEditBanner(b);
    setModal("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editBanner) {
        await adminFetch(`/admin/featured/${editBanner.id}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ title: "تم تحديث البانر" });
      } else {
        await adminFetch("/admin/featured", { method: "POST", body: JSON.stringify(form) });
        toast({ title: "تمت إضافة البانر" });
      }
      fetchBanners();
      setModal(null);
    } catch { toast({ title: "حدث خطأ", variant: "destructive" }); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا البانر؟")) return;
    await adminFetch(`/admin/featured/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchBanners();
  };

  const toggleActive = async (b: Banner) => {
    await adminFetch(`/admin/featured/${b.id}`, { method: "PUT", body: JSON.stringify({ isActive: !b.isActive }) });
    fetchBanners();
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">البانرات المميزة</h2>
            <p className="text-white/40 text-xs mt-0.5">الإعلانات والبانرات التي تظهر في الصفحة الرئيسية</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black" style={{ background: A }}>
            <Plus className="w-4 h-4" /> إضافة بانر
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="space-y-3">
            {banners.map(b => (
              <div key={b.id} className="bg-[#111111] rounded-xl border border-white/8 overflow-hidden group">
                <div className="flex items-stretch">
                  <div className="w-24 sm:w-36 shrink-0 bg-[#0a0a0a] flex items-center justify-center relative">
                    {b.image ? (
                      <img src={b.image} alt={b.title} className="w-full h-full object-cover absolute inset-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-white/20" />
                    )}
                    <div className="absolute inset-0 bg-black/30" />
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold text-sm truncate">{b.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${b.isActive ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                            {b.isActive ? "نشط" : "مخفي"}
                          </span>
                        </div>
                        {b.description && <p className="text-white/40 text-xs truncate">{b.description}</p>}
                        {b.link && (
                          <div className="flex items-center gap-1 mt-1">
                            <Link2 className="w-3 h-3" style={{ color: `${A}80` }} />
                            <span className="text-xs font-mono truncate" style={{ color: `${A}80` }}>{b.link}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleActive(b)} className={`p-1.5 rounded-lg transition-colors ${b.isActive ? "text-white/40 hover:text-yellow-400 hover:bg-yellow-500/10" : "text-white/40 hover:text-green-400 hover:bg-green-500/10"}`}>
                          {b.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/20 mt-2">ترتيب: {b.sortOrder}</div>
                  </div>
                </div>
              </div>
            ))}
            {banners.length === 0 && (
              <div className="py-16 text-center text-white/30 text-sm bg-[#111111] rounded-xl border border-white/5">
                لا توجد بانرات بعد
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="text-base font-bold text-white">{editBanner ? "تعديل بانر" : "إضافة بانر"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3">
              {[
                { label: "العنوان *", key: "title" as const, required: true, placeholder: "عنوان البانر" },
                { label: "الوصف", key: "description" as const, placeholder: "وصف مختصر" },
                { label: "رابط الصورة", key: "image" as const, placeholder: "https://...", ltr: true },
                { label: "الرابط عند الضغط", key: "link" as const, placeholder: "https://...", ltr: true },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-medium" style={{ color: `${A}99` }}>{f.label}</label>
                  <input
                    required={f.required}
                    dir={f.ltr ? "ltr" : undefined}
                    value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none placeholder-white/20"
                  />
                </div>
              ))}
              {form.image && (
                <div className="rounded-xl overflow-hidden border border-white/10 h-24">
                  <img src={form.image} alt="" className="w-full h-full object-cover" onError={() => {}} />
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all"
                  style={form.isActive ? { background: `${A}15`, borderColor: `${A}40`, color: A } : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                  {form.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {form.isActive ? "نشط" : "مخفي"}
                </button>
              </div>
            </form>
            <div className="border-t border-white/5 p-4 flex justify-end gap-2 shrink-0">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm">إلغاء</button>
              <button onClick={handleSubmit as any} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5" style={{ background: A }}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {editBanner ? "حفظ" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
