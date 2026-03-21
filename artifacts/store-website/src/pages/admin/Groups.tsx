import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, Search, Square } from "lucide-react";

export default function AdminGroups() {
  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">المجموعات</h2>
            <p className="text-[#8888aa] text-sm mt-1">إدارة مجموعات المشتركين</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> إضافة مجموعة
          </button>
        </div>

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-12 text-center">
          <p className="text-[#8888aa]">لا توجد مجموعات بعد</p>
        </div>
      </div>
    </AdminLayout>
  );
}
