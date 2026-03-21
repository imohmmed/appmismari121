import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, Trash2, Edit2, X, Loader2, Layers } from "lucide-react";
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

interface Category {
  id: number;
  name: string;
  nameAr: string | null;
  icon: string | null;
  appCount: number;
}

const ICONS = ["📱", "🎮", "🎵", "📸", "💬", "📁", "🌐", "⚡", "🔧", "🎯", "📊", "🎨", "🏥", "🛒", "📰"];

const blankForm = { name: "", nameAr: "", icon: "📁" };

export default function AdminCategories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/categories");
    setCategories(d?.categories || []);
    setLoading(false);
  };
  useEffect(() => { fetchCategories(); }, []);

  const openAdd = () => { setForm(blankForm); setEditCat(null); setModal("add"); };
  const openEdit = (cat: Category) => { setForm({ name: cat.name, nameAr: cat.nameAr || "", icon: cat.icon || "📁" }); setEditCat(cat); setModal("edit"); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editCat) {
        await adminFetch(`/admin/categories/${editCat.id}`, { method: "PUT", body: JSON.stringify(form) });
        toast({ title: "تم تحديث التصنيف" });
      } else {
        await adminFetch("/admin/categories", { method: "POST", body: JSON.stringify(form) });
        toast({ title: "تمت إضافة التصنيف" });
      }
      fetchCategories();
      setModal(null);
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا التصنيف؟")) return;
    await adminFetch(`/admin/categories/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchCategories();
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">التصنيفات</h2>
            <p className="text-white/40 text-xs mt-0.5">أقسام التطبيقات في المتجر</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black" style={{ background: A }}>
            <Plus className="w-4 h-4" /> إضافة تصنيف
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="bg-[#111111] rounded-xl border border-white/8 p-5 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: `${A}15` }}>
                    {cat.icon || "📁"}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-white font-semibold text-sm truncate">{cat.nameAr || cat.name}</p>
                <p className="text-white/40 text-xs truncate mt-0.5">{cat.name}</p>
                <div className="flex items-center gap-1 mt-3">
                  <Layers className="w-3 h-3" style={{ color: `${A}80` }} />
                  <span className="text-xs" style={{ color: `${A}80` }}>{cat.appCount} تطبيق</span>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="col-span-full py-16 text-center text-white/30 text-sm">لا توجد تصنيفات بعد</div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-base font-bold text-white">{editCat ? "تعديل تصنيف" : "إضافة تصنيف"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>الاسم بالعربي</label>
                <input required value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none"
                  placeholder="تطبيقات بلس" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>الاسم بالإنجليزي</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none"
                  placeholder="Plus Apps" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium" style={{ color: `${A}99` }}>الأيقونة</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button
                      key={ic} type="button"
                      onClick={() => setForm({ ...form, icon: ic })}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all"
                      style={form.icon === ic ? { background: `${A}25`, boxShadow: `0 0 0 1.5px ${A}` } : { background: "rgba(255,255,255,0.05)" }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
                <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[#9fbcff]/50 focus:outline-none"
                  placeholder="أو أدخل إيموجي مخصص" />
              </div>
              <div className="pt-3 border-t border-white/5 flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm">إلغاء</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5" style={{ background: A }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {editCat ? "حفظ" : "إضافة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
