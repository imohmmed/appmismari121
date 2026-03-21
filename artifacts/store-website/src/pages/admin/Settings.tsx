import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";

export default function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    siteNameAr: "مسماري +",
    siteNameEn: "Mismari+",
    logoUrl: "",
    maintenanceMode: false,
    maintenanceMessage: "المتجر تحت الصيانة حالياً، يرجى المحاولة لاحقاً",
  });

  useEffect(() => {
    fetch(`${API}/api/admin/settings`, { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } })
      .then(r => r.json()).then(d => {
        if (d.settings) {
          const s: any = {};
          d.settings.forEach((item: any) => { s[item.key] = item.value; });
          setSettings(prev => ({
            ...prev,
            siteNameAr: s.siteNameAr || prev.siteNameAr,
            siteNameEn: s.siteNameEn || prev.siteNameEn,
            logoUrl: s.logoUrl || prev.logoUrl,
            maintenanceMode: s.maintenanceMode === "true",
            maintenanceMessage: s.maintenanceMessage || prev.maintenanceMessage,
          }));
        }
      }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await fetch(`${API}/api/admin/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
        body: JSON.stringify({
          settings: [
            { key: "siteNameAr", value: settings.siteNameAr },
            { key: "siteNameEn", value: settings.siteNameEn },
            { key: "logoUrl", value: settings.logoUrl },
            { key: "maintenanceMode", value: String(settings.maintenanceMode) },
            { key: "maintenanceMessage", value: settings.maintenanceMessage },
          ]
        }),
      });
      toast({ title: "تم حفظ الإعدادات" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl" dir="rtl">
        <div>
          <h2 className="text-xl font-bold text-white">الإعدادات</h2>
          <p className="text-[#8888aa] text-sm mt-1">إعدادات الموقع والتطبيق</p>
        </div>

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-6 space-y-5">
          <h3 className="text-white font-bold text-sm">معلومات الموقع</h3>

          <div className="space-y-1.5">
            <label className="text-xs text-[#8888aa]">اسم الموقع بالعربي</label>
            <input value={settings.siteNameAr} onChange={e => setSettings({ ...settings, siteNameAr: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[#8888aa]">اسم الموقع بالإنجليزي</label>
            <input value={settings.siteNameEn} onChange={e => setSettings({ ...settings, siteNameEn: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[#8888aa]">رابط اللوقو</label>
            <input value={settings.logoUrl} onChange={e => setSettings({ ...settings, logoUrl: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 focus:outline-none" dir="ltr" placeholder="https://..." />
          </div>
        </div>

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h3 className="text-white font-bold text-sm">وضع الصيانة</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm">إيقاف المتجر مؤقتاً</p>
              <p className="text-[#8888aa] text-xs mt-0.5">عرض رسالة الصيانة للمستخدمين</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
              className={`w-12 h-6 rounded-full transition-colors ${settings.maintenanceMode ? "bg-red-500" : "bg-[#2a2a45]"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.maintenanceMode ? "translate-x-0.5" : "translate-x-6"}`} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#8888aa]">رسالة الصيانة</label>
            <textarea value={settings.maintenanceMessage} onChange={e => setSettings({ ...settings, maintenanceMessage: e.target.value })} className="w-full bg-[#1a1a2e] border border-[#2a2a45] rounded-lg py-2 px-3 text-sm text-white h-20 focus:border-blue-500 focus:outline-none" />
          </div>
        </div>

        <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm">
          <Save className="w-4 h-4" /> حفظ الإعدادات
        </button>
      </div>
    </AdminLayout>
  );
}
