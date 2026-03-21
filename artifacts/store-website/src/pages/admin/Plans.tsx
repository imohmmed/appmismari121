import { AdminLayout } from "@/components/layout/AdminLayout";

// Stub for completeness
export default function AdminPlans() {
  return (
    <AdminLayout>
      <div className="flex flex-col justify-center items-center h-[60vh] text-center">
        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
          <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">إدارة الاشتراكات</h2>
        <p className="text-muted-foreground max-w-md">واجهة إدارة الاشتراكات والباقات قيد التطوير. يمكن تعديل الباقات من قاعدة البيانات مباشرة.</p>
      </div>
    </AdminLayout>
  );
}
