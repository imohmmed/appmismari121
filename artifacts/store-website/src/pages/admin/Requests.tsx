import { AdminLayout } from "@/components/layout/AdminLayout";
import { Search, CheckSquare, Square } from "lucide-react";
import { useState } from "react";

export default function AdminRequests() {
  const [search, setSearch] = useState("");
  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#8888aa]">0 طلب</span>
          <div className="relative max-w-sm flex-1 mr-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888aa]" />
            <input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#22223a] border border-[#2a2a45] rounded-lg py-2 pr-4 pl-10 text-sm text-white placeholder-[#8888aa] focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#1e1e35] border-b border-[#2a2a45]">
              <tr>
                <th className="px-4 py-3 w-10"><Square className="w-4 h-4 text-[#8888aa]" /></th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">الاسم</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">الهاتف</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">الباقة</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">الحالة</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} className="p-8 text-center text-[#8888aa]">لا يوجد طلبات</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
