import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

interface Plan {
  id: number;
  name: string;
  nameAr: string;
  price: number;
  currency: string;
  duration: string;
  features: string[];
  excludedFeatures: string[];
  isPopular: boolean;
}

export default function AdminPackages() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "", nameAr: "", price: 0, currency: "IQD", duration: "month",
    features: "" as string, excludedFeatures: "" as string, isPopular: false
  });

  const fetchPlans = () => {
    fetch(`${API}/api/admin/plans`, { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } })
      .then(r => r.json()).then(d => setPlans(d.plans || [])).catch(() => {});
  };
  useEffect(fetchPlans, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API}/api/admin/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
        body: JSON.stringify({
          ...formData,
          features: formData.features.split("\n").filter(Boolean),
          excludedFeatures: formData.excludedFeatures.split("\n").filter(Boolean),
        }),
      });
      fetchPlans();
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
            <h2 className="text-xl font-bold text-white">باقات الاشتراك</h2>
            <p className="text-[#8888aa] text-sm mt-1">إدارة وتعديل باقات المتجر</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> إضافة باقة
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map(plan => (
            <div key={plan.id} className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-6 relative">
              {plan.isPopular && (
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="text-purple-400 text-lg">👑</span>
                </div>
                <div>
                  <p className="text-white font-bold">{plan.nameAr || plan.name}</p>
                  <p className="text-[#8888aa] text-xs">{plan.duration === "month" ? "شهري" : plan.duration === "year" ? "سنوي" : plan.duration}</p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-2xl font-black text-white">{Number(plan.price).toLocaleString()}</span>
                <span className="text-[#8888aa] text-sm mr-1">د.ع / {plan.duration === "month" ? "٣٦٥ يوم" : plan.duration}</span>
              </div>

              <div className="space-y-2 mb-4">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-[#8888aa]">
                    <Check className="w-3.5 h-3.5 text-green-400" /> {f}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#2a2a45]">
                <button className="p-2 rounded-lg text-[#8888aa] hover:text-red-400 hover:bg-[#1e1e35]"><Trash2 className="w-4 h-4" /></button>
                <button className="p-2 rounded-lg text-[#8888aa] hover:text-white hover:bg-[#1e1e35]"><Edit2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#22223a] border border-[#2a2a45] rounded-xl w-full max-w-lg shadow-2xl" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a45]">
              <h3 className="text-lg font-bold text-white">إضافة باقة</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1e1e35] text-[#8888aa]"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">الاسم بالإنجليزي</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">الاسم بالعربي</label>
                  <input value={formData.nameAr} onChange={e => setFormData({ ...formData, nameAr: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">السعر</label>
                  <input type="number" required value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">المدة</label>
                  <select value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none">
                    <option value="month">شهري</option>
                    <option value="year">سنوي</option>
                    <option value="lifetime">مدى الحياة</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#8888aa]">المميزات (سطر لكل ميزة)</label>
                <textarea value={formData.features} onChange={e => setFormData({ ...formData, features: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white h-24 focus:border-blue-500 focus:outline-none" />
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
