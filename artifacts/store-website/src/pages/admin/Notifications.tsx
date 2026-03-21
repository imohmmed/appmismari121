import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Send, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminNotifications() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ title: "", body: "", target: "all" });
  const [history] = useState<any[]>([]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "تم إرسال الإشعار (Push)" });
    setFormData({ title: "", body: "", target: "all" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl" dir="rtl">
        <div>
          <h2 className="text-xl font-bold text-white">سجل الإشعارات</h2>
          <p className="text-[#8888aa] text-sm mt-1">الإشعارات المرسلة مسبقاً</p>
        </div>

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-bold text-sm">إرسال إشعار جديد (Push)</h3>
          </div>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#8888aa]">عنوان الإشعار</label>
              <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#8888aa]">نص الإشعار</label>
              <textarea required value={formData.body} onChange={e => setFormData({ ...formData, body: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white h-24 focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#8888aa]">المستهدفين</label>
              <select value={formData.target} onChange={e => setFormData({ ...formData, target: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none">
                <option value="all">الجميع</option>
              </select>
            </div>
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm">
              <Send className="w-4 h-4" /> إرسال الآن
            </button>
          </form>
        </div>

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-6">
          <h3 className="text-white font-bold text-sm mb-4">الإشعارات السابقة</h3>
          {history.length === 0 ? (
            <p className="text-[#8888aa] text-sm text-center py-4">لا يوجد إشعارات سابقة</p>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
}
