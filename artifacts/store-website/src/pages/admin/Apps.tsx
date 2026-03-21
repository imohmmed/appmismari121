import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminListApps, useAdminCreateApp, useAdminUpdateApp, useAdminDeleteApp } from "@workspace/api-client-react";
import {
  Plus, Search, X, Upload, Link2, MoreVertical,
  Copy, Edit2, EyeOff, FlaskConical, Trash2, CheckSquare, Square
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminListAppsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import type { App } from "@workspace/api-client-react";

export default function AdminApps() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAdminListApps({ page: 1, limit: 100 });
  const apps = data?.apps || [];

  const createMutation = useAdminCreateApp();
  const updateMutation = useAdminUpdateApp();
  const deleteMutation = useAdminDeleteApp();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [formData, setFormData] = useState({
    name: "", description: "", icon: "", categoryId: 1, tag: "new" as any,
    version: "", size: "", bundleId: "", isFeatured: false, isHot: false
  });

  const filteredApps = useMemo(() => {
    if (!search.trim()) return apps;
    const q = search.toLowerCase();
    return apps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.description || "").toLowerCase().includes(q) ||
      (a.categoryName || "").toLowerCase().includes(q)
    );
  }, [apps, search]);

  const allFilteredSelected = filteredApps.length > 0 && filteredApps.every(a => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
      setShowQuickAction(false);
    } else {
      const ids = new Set(filteredApps.map(a => a.id));
      setSelectedIds(ids);
      setShowQuickAction(true);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
    setShowQuickAction(next.size > 0);
  };

  const openCreate = () => {
    setEditingApp(null);
    setFormData({ name: "", description: "", icon: "", categoryId: 1, tag: "new", version: "", size: "", bundleId: "", isFeatured: false, isHot: false });
    setIsModalOpen(true);
  };

  const openEdit = (app: App) => {
    setEditingApp(app);
    setFormData({
      name: app.name, description: app.description || "", icon: app.icon, categoryId: app.categoryId,
      tag: app.tag, version: app.version || "", size: app.size || "", bundleId: (app as any).bundleId || "",
      isFeatured: app.isFeatured || false, isHot: app.isHot || false
    });
    setIsModalOpen(true);
    setMenuOpenId(null);
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
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا التطبيق؟")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
        toast({ title: "تم الحذف بنجاح" });
      } catch {
        toast({ title: "حدث خطأ", variant: "destructive" });
      }
    }
    setMenuOpenId(null);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} تطبيق؟`)) return;
    for (const id of selectedIds) {
      try { await deleteMutation.mutateAsync({ id }); } catch {}
    }
    queryClient.invalidateQueries({ queryKey: getAdminListAppsQueryKey() });
    setSelectedIds(new Set());
    setShowQuickAction(false);
    toast({ title: `تم حذف ${selectedIds.size} تطبيق` });
  };

  const statusBadge = (app: App) => {
    const a = app as any;
    if (a.isHidden) return <span className="px-2 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-400">مخفي</span>;
    if (a.isTestMode) return <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">تجريبي</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400">نشط</span>;
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">قائمة التطبيقات</h2>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#8888aa] hover:text-white bg-[#22223a] border border-[#2a2a45] hover:border-[#3a3a55] transition-colors">
              <Upload className="w-4 h-4" /> رفع ملف
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#8888aa] hover:text-white bg-[#22223a] border border-[#2a2a45] hover:border-[#3a3a55] transition-colors">
              <Link2 className="w-4 h-4" /> عبر رابط
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
              <Plus className="w-4 h-4" /> إضافة
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888aa]" />
            <input
              type="text"
              placeholder="ابحث عن تطبيق..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#22223a] border border-[#2a2a45] rounded-lg py-2 pr-4 pl-10 text-sm text-white placeholder-[#8888aa] focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {showQuickAction && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-[#2a2a50] border border-[#3a3a65] rounded-lg px-4 py-2.5">
            <span className="text-sm text-white">{selectedIds.size} محدد</span>
            <div className="flex-1" />
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
              <Trash2 className="w-3 h-3" /> حذف الكل
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors">
              <EyeOff className="w-3 h-3" /> إخفاء الكل
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">
              <FlaskConical className="w-3 h-3" /> وضع التجربة
            </button>
          </div>
        )}

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#1e1e35] border-b border-[#2a2a45]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-[#8888aa] hover:text-white">
                      {allFilteredSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الاسم</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الإصدار</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">Bundle ID</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الحجم</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الحالة</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الفئة</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-[#8888aa]">جاري التحميل...</td></tr>
                ) : filteredApps.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-[#8888aa]">لا توجد تطبيقات</td></tr>
                ) : (
                  filteredApps.map((app) => (
                    <tr key={app.id} className="border-b border-[#2a2a45] hover:bg-[#1e1e35] transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(app.id)} className="text-[#8888aa] hover:text-white">
                          {selectedIds.has(app.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={app.icon} alt={app.name} className="w-9 h-9 rounded-lg object-cover bg-[#2a2a45]" />
                          <span className="text-white font-medium">{app.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8888aa]">{app.version || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa] text-xs font-mono">{(app as any).bundleId || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa]">{app.size || "-"}</td>
                      <td className="px-4 py-3">{statusBadge(app)}</td>
                      <td className="px-4 py-3 text-[#8888aa]">{app.categoryName}</td>
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === app.id ? null : app.id)}
                          className="p-1 rounded hover:bg-[#2a2a50] text-[#8888aa] hover:text-white transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpenId === app.id && (
                          <div className="absolute left-0 top-full mt-1 w-44 bg-[#22223a] border border-[#2a2a45] rounded-lg shadow-xl z-50 py-1 text-right">
                            <button
                              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/app/${app.id}`); toast({ title: "تم نسخ الرابط" }); setMenuOpenId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#8888aa] hover:text-white hover:bg-[#1e1e35]"
                            >
                              <Copy className="w-3.5 h-3.5" /> نسخ الرابط
                            </button>
                            <button
                              onClick={() => openEdit(app)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#8888aa] hover:text-white hover:bg-[#1e1e35]"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> تعديل التطبيق
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-yellow-400 hover:bg-[#1e1e35]">
                              <EyeOff className="w-3.5 h-3.5" /> وضع الإخفاء
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-400 hover:bg-[#1e1e35]">
                              <FlaskConical className="w-3.5 h-3.5" /> وضع التجربة
                            </button>
                            <div className="my-1 border-t border-[#2a2a45]" />
                            <button
                              onClick={() => handleDelete(app.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#1e1e35]"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> حذف
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#22223a] border border-[#2a2a45] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a45]">
              <h3 className="text-lg font-bold text-white">{editingApp ? "تعديل تطبيق" : "إضافة تطبيق جديد"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1e1e35] text-[#8888aa]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">اسم التطبيق</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">رابط الأيقونة</label>
                  <input required value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs text-[#8888aa]">الوصف</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white h-20 focus:border-blue-500 focus:outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">Bundle ID</label>
                  <input value={formData.bundleId} onChange={e => setFormData({ ...formData, bundleId: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" placeholder="com.example.app" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">القسم</label>
                  <select value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: Number(e.target.value) })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none">
                    <option value={1}>تطبيقات بلس</option>
                    <option value={2}>ألعاب مهكرة</option>
                    <option value={3}>أفلام ومسلسلات</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">الإصدار</label>
                  <input value={formData.version} onChange={e => setFormData({ ...formData, version: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#8888aa]">الحجم</label>
                  <input value={formData.size} onChange={e => setFormData({ ...formData, size: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" placeholder="150 MB" />
                </div>
              </div>

              <div className="pt-4 border-t border-[#2a2a45] flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border border-[#2a2a45] text-[#8888aa] hover:text-white text-sm">إلغاء</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
