import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminListApps, useAdminCreateApp, useAdminUpdateApp, useAdminDeleteApp } from "@workspace/api-client-react";
import { Plus, Search, Edit2, Trash2, X, Image as ImageIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminListAppsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import type { App } from "@workspace/api-client-react";

export default function AdminApps() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListApps({ page: 1, limit: 50 });
  const apps = data?.apps || [];

  const createMutation = useAdminCreateApp();
  const updateMutation = useAdminUpdateApp();
  const deleteMutation = useAdminDeleteApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", icon: "", categoryId: 1, tag: "new" as any, version: "", size: "", isFeatured: false, isHot: false
  });

  const openCreate = () => {
    setEditingApp(null);
    setFormData({ name: "", description: "", icon: "", categoryId: 1, tag: "new", version: "", size: "", isFeatured: false, isHot: false });
    setIsModalOpen(true);
  };

  const openEdit = (app: App) => {
    setEditingApp(app);
    setFormData({
      name: app.name, description: app.description || "", icon: app.icon, categoryId: app.categoryId, 
      tag: app.tag, version: app.version || "", size: app.size || "", isFeatured: app.isFeatured || false, isHot: app.isHot || false
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingApp) {
        await updateMutation.mutateAsync({ id: editingApp.id, data: formData });
        toast({ title: "تم التحديث بنجاح" });
      } else {
        await createMutation.mutateAsync({ data: formData });
        toast({ title: "تمت الإضافة بنجاح" });
      }
      queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
      setIsModalOpen(false);
    } catch (err) {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا التطبيق؟")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
        toast({ title: "تم الحذف بنجاح" });
      } catch (err) {
        toast({ title: "حدث خطأ", variant: "destructive" });
      }
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold">إدارة التطبيقات</h2>
          <p className="text-muted-foreground mt-1">إضافة، تعديل، أو حذف تطبيقات المتجر</p>
        </div>
        <button onClick={openCreate} className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
          <Plus className="w-5 h-5" />
          إضافة تطبيق
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-white/5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="ابحث عن تطبيق..." 
              className="w-full bg-background border border-white/10 rounded-lg py-2 pr-10 pl-4 focus:outline-none focus:border-primary text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-white/5 border-b border-white/5 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-semibold">التطبيق</th>
                <th className="px-6 py-4 font-semibold">القسم</th>
                <th className="px-6 py-4 font-semibold">الوسم</th>
                <th className="px-6 py-4 font-semibold">الحجم/الإصدار</th>
                <th className="px-6 py-4 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
              ) : apps.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد تطبيقات</td></tr>
              ) : (
                apps.map((app) => (
                  <tr key={app.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={app.icon} alt={app.name} className="w-10 h-10 rounded-xl object-cover bg-card border border-white/10" />
                        <div>
                          <p className="font-bold">{app.name}</p>
                          <div className="flex gap-1 mt-1">
                            {app.isFeatured && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 rounded-md">رائج</span>}
                            {app.isHot && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 rounded-md">ساخن</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{app.categoryName}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                        {app.tag}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex flex-col">
                        <span>{app.version || '-'}</span>
                        <span className="text-xs opacity-70">{app.size || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(app)} className="p-2 hover:bg-primary/20 hover:text-primary rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(app.id)} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-xl font-bold">{editingApp ? "تعديل تطبيق" : "إضافة تطبيق جديد"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1 space-y-2">
                  <label className="text-sm text-muted-foreground">اسم التطبيق</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 focus:border-primary" />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-2">
                  <label className="text-sm text-muted-foreground">رابط الأيقونة</label>
                  <div className="flex gap-2">
                    <input required value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="flex-1 bg-background border border-white/10 rounded-xl py-2 px-3 focus:border-primary" dir="ltr" />
                    {formData.icon && <img src={formData.icon} className="w-10 h-10 rounded-xl object-cover bg-black" />}
                  </div>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <label className="text-sm text-muted-foreground">الوصف</label>
                  <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 focus:border-primary h-20" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">القسم</label>
                  <select value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: Number(e.target.value)})} className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 focus:border-primary appearance-none">
                    <option value={1}>تطبيقات بلس</option>
                    <option value={2}>ألعاب مهكرة</option>
                    <option value={3}>أفلام ومسلسلات</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">الوسم (Tag)</label>
                  <select value={formData.tag} onChange={e => setFormData({...formData, tag: e.target.value as any})} className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 focus:border-primary appearance-none">
                    <option value="new">جديد</option>
                    <option value="hot">ساخن</option>
                    <option value="tweaked">بلس</option>
                    <option value="modded">معدل</option>
                    <option value="hacked">مهكر</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">الإصدار</label>
                  <input value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 focus:border-primary" dir="ltr" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">الحجم</label>
                  <input value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} className="w-full bg-background border border-white/10 rounded-xl py-2 px-3 focus:border-primary" dir="ltr" placeholder="ex: 150 MB" />
                </div>

                <div className="col-span-2 flex gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isFeatured} onChange={e => setFormData({...formData, isFeatured: e.target.checked})} className="w-4 h-4 rounded accent-primary bg-background border-white/10" />
                    <span>تطبيق رائج (في السلايدر)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isHot} onChange={e => setFormData({...formData, isHot: e.target.checked})} className="w-4 h-4 rounded accent-primary bg-background border-white/10" />
                    <span>تطبيق ساخن (الأكثر تحميلاً)</span>
                  </label>
                </div>
              </div>
              
              <div className="pt-6 border-t border-white/5 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 rounded-xl border border-white/10 hover:bg-white/5">إلغاء</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-8 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/25 disabled:opacity-50">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
