import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, Search, CheckSquare, Square, Trash2, X } from "lucide-react";

interface SubCode {
  id: number;
  code: string;
  group: string;
  subscriber: string;
  plan: string;
  price: number;
  status: string;
  createdAt: string;
}

export default function AdminSubCodes() {
  const [codes] = useState<SubCode[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return codes;
    const q = search.toLowerCase();
    return codes.filter(c => c.code.toLowerCase().includes(q) || (c.subscriber || "").toLowerCase().includes(q));
  }, [codes, search]);

  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
  const toggleAll = () => { allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(c => c.id))); };
  const toggle = (id: number) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };

  return (
    <AdminLayout>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> إنشاء كود
          </button>
          <div className="relative max-w-sm flex-1 mr-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888aa]" />
            <input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-[#22223a] border border-[#2a2a45] rounded-lg py-2 pr-4 pl-10 text-sm text-white placeholder-[#8888aa] focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-[#2a2a50] border border-[#3a3a65] rounded-lg px-4 py-2.5">
            <span className="text-sm text-white">{selectedIds.size} محدد</span>
            <div className="flex-1" />
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400"><Trash2 className="w-3 h-3" /> حذف</button>
          </div>
        )}

        <div className="bg-[#22223a] rounded-xl border border-[#2a2a45] overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#1e1e35] border-b border-[#2a2a45]">
              <tr>
                <th className="px-4 py-3 w-10"><button onClick={toggleAll}>{allSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-[#8888aa]" />}</button></th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">كود</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">المجموعة</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">السعر</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">المدة</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">الاستخدام</th>
                <th className="px-4 py-3 font-medium text-[#8888aa]">المستخدمي</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-[#8888aa]">لا يوجد كودات</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="border-b border-[#2a2a45] hover:bg-[#1e1e35]">
                  <td className="px-4 py-3"><button onClick={() => toggle(c.id)}>{selectedIds.has(c.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4 text-[#8888aa]" />}</button></td>
                  <td className="px-4 py-3 text-white font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-3 text-[#8888aa]">{c.group}</td>
                  <td className="px-4 py-3 text-[#8888aa]">{c.price}</td>
                  <td className="px-4 py-3 text-[#8888aa]">{c.plan}</td>
                  <td className="px-4 py-3 text-[#8888aa]">{c.status}</td>
                  <td className="px-4 py-3 text-[#8888aa]">{c.subscriber || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#22223a] border border-[#2a2a45] rounded-xl w-full max-w-md shadow-2xl p-5" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">إنشاء كود اشتراك</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1e1e35] text-[#8888aa]"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-[#8888aa] text-sm">قريباً - ربط الكودات بالمشتركين</p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
