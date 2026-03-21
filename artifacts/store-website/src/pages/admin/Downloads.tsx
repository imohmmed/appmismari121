import { AdminLayout } from "@/components/layout/AdminLayout";
import { Download, TrendingUp, Calendar } from "lucide-react";

export default function AdminDownloads() {
  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div>
          <h2 className="text-xl font-bold text-white">إحصائيات التحميل</h2>
          <p className="text-[#8888aa] text-sm mt-1">تحليل لإحصائيات عمليات التحميل وأحدث التطبيقات</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><Download className="w-4 h-4 text-blue-400" /></div>
              <span className="text-[#8888aa] text-xs">إجمالي التحميلات (الكل)</span>
            </div>
            <p className="text-3xl font-black text-white">0</p>
          </div>
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center"><Calendar className="w-4 h-4 text-purple-400" /></div>
              <span className="text-[#8888aa] text-xs">تحميلات الأسبوع</span>
            </div>
            <p className="text-3xl font-black text-white">0</p>
            <p className="text-green-400 text-xs mt-1">+0% عن الأسبوع الماضي</p>
          </div>
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-cyan-400" /></div>
              <span className="text-[#8888aa] text-xs">تحميلات اليوم</span>
            </div>
            <p className="text-3xl font-black text-white">0</p>
            <p className="text-green-400 text-xs mt-1">+0% عن الأمس</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <h3 className="text-white font-bold mb-4">التطبيقات الأكثر تحميلاً</h3>
            <div className="space-y-3">
              <p className="text-[#8888aa] text-sm text-center py-8">لا توجد بيانات بعد</p>
            </div>
          </div>
          <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-5">
            <h3 className="text-white font-bold mb-4">معدل التحميل (آخر 7 أيام)</h3>
            <div className="h-48 flex items-center justify-center">
              <p className="text-[#8888aa] text-sm">لا توجد بيانات بعد</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
