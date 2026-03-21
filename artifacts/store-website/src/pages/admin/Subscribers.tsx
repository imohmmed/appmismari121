import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Search, CheckSquare, Square, Trash2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Subscriber {
  id: number;
  subscriberName: string;
  phone: string;
  udid: string;
  deviceType: string;
  code: string;
  groupName: string;
  planName: string;
  createdAt: string;
}

export default function AdminSubscribers() {
  const { toast } = useToast();
  const [subscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return subscribers;
    const q = search.toLowerCase();
    return subscribers.filter(s =>
      (s.subscriberName || "").toLowerCase().includes(q) ||
      (s.phone || "").includes(q) ||
      (s.udid || "").toLowerCase().includes(q) ||
      (s.code || "").toLowerCase().includes(q)
    );
  }, [subscribers, search]);

  const allSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
  const toggleAll = () => {
    if (allSelected) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(filtered.map(s => s.id))); }
  };
  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#8888aa]">{subscribers.length} مشترك</span>
          <div className="relative max-w-sm flex-1 mr-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888aa]" />
            <input
              placeholder="ابحث بالاسم، الرقم، UDID، الكود..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#22223a] border border-[#2a2a45] rounded-lg py-2 pr-4 pl-10 text-sm text-white placeholder-[#8888aa] focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-[#2a2a50] border border-[#3a3a65] rounded-lg px-4 py-2.5">
            <span className="text-sm text-white">{selectedIds.size} محدد</span>
            <div className="flex-1" />
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30">
              <MessageCircle className="w-3 h-3" /> رسالة واتساب جماعية
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30">
              <Trash2 className="w-3 h-3" /> حذف المحدد
            </button>
          </div>
        )}

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-[#1e1e35] border-b border-[#2a2a45]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-[#8888aa] hover:text-white">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">المشترك</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الباقة</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">UDID</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الجهاز</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">كود الاشتراك</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">المجموعة</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">الباقة</th>
                  <th className="px-4 py-3 font-medium text-[#8888aa]">تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-[#8888aa]">لا يوجد مشتركين</td></tr>
                ) : (
                  filtered.map(sub => (
                    <tr key={sub.id} className="border-b border-[#2a2a45] hover:bg-[#1e1e35]">
                      <td className="px-4 py-3"><button onClick={() => toggle(sub.id)}>{selectedIds.has(sub.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-[#8888aa]" />}</button></td>
                      <td className="px-4 py-3 text-white">{sub.subscriberName || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa]">{sub.phone || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa] text-xs font-mono">{sub.udid || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa]">{sub.deviceType || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa] text-xs font-mono">{sub.code}</td>
                      <td className="px-4 py-3 text-[#8888aa]">{sub.groupName || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa]">{sub.planName || "-"}</td>
                      <td className="px-4 py-3 text-[#8888aa] text-xs">{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString("ar-IQ") : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
