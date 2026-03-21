import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, Trash2, Edit2, Eye, EyeOff, GripVertical, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeaturedItem {
  id: number;
  title: string;
  description: string;
  image: string;
  link: string;
  isActive: boolean;
}

const API = import.meta.env.VITE_API_URL || "";

export default function AdminFeatured() {
  const { toast } = useToast();
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeaturedItem | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "", image: "", link: "" });

  useEffect(() => {
    fetch(`${API}/api/admin/featured`, { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } })
      .then(r => r.json()).then(d => setItems(d.banners || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingItem(null);
    setFormData({ title: "", description: "", image: "", link: "" });
    setIsModalOpen(true);
  };

  const openEdit = (item: FeaturedItem) => {
    setEditingItem(item);
    setFormData({ title: item.title, description: item.description, image: item.image, link: item.link });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem ? `${API}/api/admin/featured/${editingItem.id}` : `${API}/api/admin/featured`;
      const method = editingItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (editingItem) {
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...data } : i));
      } else {
        setItems(prev => [...prev, data]);
      }
      setIsModalOpen(false);
      toast({ title: editingItem ? "تم التحديث" : "تمت الإضافة" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("حذف هذا البانر؟")) return;
    try {
      await fetch(`${API}/api/admin/featured/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
      });
      setItems(prev => prev.filter(i => i.id !== id));
      toast({ title: "تم الحذف" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">المميزات (Featured)</h2>
            <p className="text-[#8888aa] text-sm mt-1">إدارة البانرات التي تظهر في الصفحة الرئيسية للتطبيق</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> إضافة بانر
          </button>
        </div>

        {items.length === 0 ? (
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-12 text-center">
            <p className="text-[#8888aa]">لا توجد بانرات. أضف بانر جديد ليظهر في التطبيق.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-4 flex items-center gap-4">
                <div className="text-[#8888aa] cursor-grab"><GripVertical className="w-4 h-4" /></div>
                <span className="text-blue-400 font-bold text-sm w-6">{idx + 1}</span>
                {item.image && <img src={item.image} className="w-16 h-10 rounded-lg object-cover bg-[#2a2a45]" />}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{item.title}</p>
                  <p className="text-[#8888aa] text-xs truncate">{item.description}</p>
                  <div className="flex gap-1 mt-1">
                    {item.link && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Link</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">App {idx + 1}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg text-[#8888aa] hover:text-red-400 hover:bg-[#1e1e35]"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-[#8888aa] hover:text-white hover:bg-[#1e1e35]"><Edit2 className="w-4 h-4" /></button>
                  <button className="p-2 rounded-lg text-[#8888aa] hover:text-white hover:bg-[#1e1e35]">{item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#22223a] border border-[#2a2a45] rounded-xl w-full max-w-lg shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a45]">
              <h3 className="text-lg font-bold text-white">{editingItem ? "تعديل بانر" : "إضافة بانر جديد"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1e1e35] text-[#8888aa]"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">العنوان</label>
                <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">الوصف</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white h-20 focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">رابط الصورة</label>
                <input value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">الرابط (عند الضغط)</label>
                <input value={formData.link} onChange={e => setFormData({ ...formData, link: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
              </div>
              <div className="pt-3 border-t border-[#2a2a45] flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#2a2a45] text-[#8888aa] text-sm">إلغاء</button>
                <button type="submit" className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
