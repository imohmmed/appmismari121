import { AdminLayout } from "@/components/layout/AdminLayout";
import { DollarSign, Calendar, Search, Square } from "lucide-react";

export default function AdminPurchases() {
  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center"><DollarSign className="w-4 h-4 text-green-400" /></div>
              <span className="text-[#8888aa] text-xs">إجمالي الأرباح</span>
            </div>
            <p className="text-2xl font-bold text-white">٠ د.ع</p>
          </div>
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><Calendar className="w-4 h-4 text-blue-400" /></div>
              <span className="text-[#8888aa] text-xs">أرباح هذا الشهر</span>
            </div>
            <p className="text-2xl font-bold text-white">٠ د.ع</p>
          </div>
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center"><DollarSign className="w-4 h-4 text-purple-400" /></div>
              <span className="text-[#8888aa] text-xs">عدد المدفوعات</span>
            </div>
            <p className="text-2xl font-bold text-white">0</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888aa]" />
          <input placeholder="ابحث بالاسم، الكود، المبلغ..." className="w-full bg-[#22223a] border border-[#2a2a45] rounded-lg py-2 pr-4 pl-10 text-sm text-white placeholder-[#8888aa] focus:outline-none focus:border-blue-500" />
        </div>

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#1e1e35] border-b border-[#2a2a45]">
              <tr>
                <th className="px-4 py-3 w-10"><Square className="w-4 h-4 text-[#8888aa]" /></th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">المشترك</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">كود الاشتراك</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">الباقة</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">المجموعة</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">المبلغ</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">التاريخ</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">الحالة</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={8} className="p-8 text-center text-[#8888aa]">لا يوجد عمليات شراء</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
