import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminGetStats } from "@workspace/api-client-react";
import {
  DollarSign, Smartphone, Users, Link2, Package, Star,
  CreditCard, ShoppingBag
} from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminGetStats();

  const statCards = [
    { title: "إجمالي الأرباح", value: "٠ د.ع", icon: DollarSign, color: "#22c55e" },
    { title: "المشتركين النشطين", value: String(stats?.activeSubscriptions || 0), icon: Users, color: "#8b5cf6" },
    { title: "إجمالي التطبيقات", value: String(stats?.totalApps || 0), icon: Smartphone, color: "#3b82f6" },
    { title: "إجمالي التحميلات", value: "0", icon: ShoppingBag, color: "#06b6d4" },
  ];

  const statCards2 = [
    { title: "الاشتراكات المفعّلة", value: String(stats?.activeSubscriptions || 0), icon: Star, color: "#f59e0b" },
    { title: "كودات الاشتراك", value: String(stats?.totalSubscriptions || 0), icon: Link2, color: "#ef4444" },
    { title: "الباقات", value: "2", icon: Package, color: "#8b5cf6" },
    { title: "الأقسام", value: String(stats?.totalCategories || 0), icon: CreditCard, color: "#10b981" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <div key={i} className="bg-[#22223a] rounded-xl p-5 border border-[#2a2a45]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#8888aa] text-xs">{stat.title}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + "20" }}>
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {isLoading ? "..." : stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards2.map((stat, i) => (
            <div key={i} className="bg-[#22223a] rounded-xl p-5 border border-[#2a2a45]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#8888aa] text-xs">{stat.title}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + "20" }}>
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">
                {isLoading ? "..." : stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#22223a] rounded-xl p-5 border border-[#2a2a45]">
            <h3 className="text-white font-bold mb-1">حالة النظام</h3>
            <p className="text-[#8888aa] text-xs mb-4">معلومات عامة</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[#2a2a45]">
                <span className="text-white text-sm">حالة السيرفر</span>
                <span className="text-green-400 text-sm flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" /> يعمل
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#2a2a45]">
                <span className="text-white text-sm">الباقات المفعلة</span>
                <span className="text-white text-sm">2</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-white text-sm">الأقسام</span>
                <span className="text-white text-sm">{stats?.totalCategories || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#22223a] rounded-xl p-5 border border-[#2a2a45]">
            <h3 className="text-white font-bold mb-4">ملخص سريع</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-[#2a2a45]">
                <span className="text-[#8888aa] text-sm">عدد عمليات الشراء</span>
                <span className="text-white text-sm">0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#2a2a45]">
                <span className="text-[#8888aa] text-sm">المشتركين النشطين</span>
                <span className="text-white text-sm">{stats?.activeSubscriptions || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#8888aa] text-sm">التطبيقات المضافة</span>
                <span className="text-white text-sm">{stats?.totalApps || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
