import { AdminLayout } from "@/components/layout/AdminLayout";

// Stub for completeness to fulfill all routes. Uses similar pattern to Apps.
export default function AdminCategories() {
  return (
    <AdminLayout>
      <div className="flex flex-col justify-center items-center h-[60vh] text-center">
        <div className="w-20 h-20 bg-card rounded-2xl flex items-center justify-center mb-6 border border-border">
          <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">إدارة الأقسام</h2>
        <p className="text-muted-foreground max-w-md">واجهة إدارة الأقسام قيد التطوير. يتم حالياً جلب الأقسام تلقائياً في التطبيق الرئيسي.</p>
      </div>
    </AdminLayout>
  );
}
