import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

interface Category {
  id: number;
  name: string;
  nameAr: string;
  icon: string;
  appCount: number;
}

export default function AdminCategories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", nameAr: "", icon: "folder" });

  const fetchCategories = () => {
    fetch(`${API}/api/admin/categories`, { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } })
      .then(r => r.json()).then(d => setCategories(d.categories || [])).catch(() => {});
  };
  useEffect(fetchCategories, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API}/api/admin/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
        body: JSON.stringify(formData),
      });
      fetchCategories();
      setIsModalOpen(false);
      toast({ title: "تمت الإضافة بنجاح" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">التصنيفات</h2>
            <p className="text-[#8888aa] text-sm mt-1">الأقسام الموجودة في التطبيق</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> إضافة تصنيف
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-lg">
                    {cat.icon === "folder" ? "📁" : cat.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{cat.nameAr || cat.name}</p>
                    <p className="text-[#8888aa] text-xs">{cat.name}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8888aa] text-xs">{cat.appCount} تطبيق</span>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded text-[#8888aa] hover:text-white hover:bg-[#1e1e35]"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button className="p-1.5 rounded text-[#8888aa] hover:text-red-400 hover:bg-[#1e1e35]"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#22223a] border border-[#2a2a45] rounded-xl w-full max-w-md shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a45]">
              <h3 className="text-lg font-bold text-white">إضافة تصنيف</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1e1e35] text-[#8888aa]"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">الاسم بالإنجليزي</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">الاسم بالعربي</label>
                <input value={formData.nameAr} onChange={e => setFormData({ ...formData, nameAr: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">الأيقونة</label>
                <input value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
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
