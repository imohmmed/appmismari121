import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Plus, X, Trash2, Edit2, Loader2, Star, Check, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers || {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (res.status === 204) return null;
  return res.json();
}

interface Plan {
  id: number;
  name: string;
  nameAr: string | null;
  price: number;
  currency: string;
  duration: string;
  features: string[];
  excludedFeatures: string[];
  isPopular: boolean;
}

const DURATION_LABELS: Record<string, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  yearly: "سنوي",
  lifetime: "مدى الحياة",
};

const PLAN_COLORS = [A, "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

const blankPlan = {
  name: "", nameAr: "", price: "", currency: "IQD", duration: "monthly",
  features: [""] as string[], excludedFeatures: [] as string[], isPopular: false,
};

export default function AdminPackages() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(blankPlan);
  const [saving, setSaving] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/plans");
    setPlans(d?.plans || []);
    setLoading(false);
  };
  useEffect(() => { fetchPlans(); }, []);

  const openAdd = () => { setForm(blankPlan); setEditPlan(null); setModal("add"); };
  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      nameAr: plan.nameAr || "",
      price: String(plan.price),
      currency: plan.currency,
      duration: plan.duration,
      features: plan.features.length > 0 ? plan.features : [""],
      excludedFeatures: plan.excludedFeatures || [],
      isPopular: plan.isPopular,
    });
    setEditPlan(plan);
    setModal("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      name: form.name,
      nameAr: form.nameAr || null,
      price: Number(form.price),
      currency: form.currency,
      duration: form.duration,
      features: form.features.filter(f => f.trim()),
      excludedFeatures: form.excludedFeatures.filter(f => f.trim()),
      isPopular: form.isPopular,
    };
    try {
      if (editPlan) {
        await adminFetch(`/admin/plans/${editPlan.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "تم تحديث الباقة" });
      } else {
        await adminFetch("/admin/plans", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "تمت إضافة الباقة" });
      }
      fetchPlans();
      setModal(null);
    } catch { toast({ title: "حدث خطأ", variant: "destructive" }); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الباقة؟")) return;
    await adminFetch(`/admin/plans/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchPlans();
  };

  const updateFeature = (i: number, val: string, type: "features" | "excludedFeatures") => {
    const arr = [...form[type]];
    arr[i] = val;
    setForm({ ...form, [type]: arr });
  };
  const addFeature = (type: "features" | "excludedFeatures") =>
    setForm({ ...form, [type]: [...form[type], ""] });
  const removeFeature = (i: number, type: "features" | "excludedFeatures") => {
    const arr = form[type].filter((_, idx) => idx !== i);
    setForm({ ...form, [type]: arr.length > 0 ? arr : type === "features" ? [""] : [] });
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">الباقات</h2>
            <p className="text-white/40 text-xs mt-0.5">خطط الاشتراك المتاحة في المتجر</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black"
            style={{ background: A }}
          >
            <Plus className="w-4 h-4" /> إضافة باقة
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-[#111111] rounded-2xl border border-white/8 py-24 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${A}15` }}>
              <Package className="w-7 h-7" style={{ color: `${A}70` }} />
            </div>
            <p className="text-white/30 text-sm">لا توجد باقات بعد</p>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black" style={{ background: A }}>
              <Plus className="w-4 h-4" /> إضافة أول باقة
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((plan, idx) => {
              const color = PLAN_COLORS[idx % PLAN_COLORS.length];
              return (
                <div
                  key={plan.id}
                  className="rounded-2xl p-5 border relative group overflow-hidden"
                  style={{
                    background: "#111111",
                    borderColor: plan.isPopular ? `${color}50` : "rgba(255,255,255,0.07)",
                    boxShadow: plan.isPopular ? `0 0 0 1px ${color}20` : undefined,
                  }}
                >
                  {/* Color accent bar at top */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />

                  {plan.isPopular && (
                    <div
                      className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: `${color}20`, color }}
                    >
                      <Star className="w-2.5 h-2.5 fill-current" /> الأكثر طلباً
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3 pt-1">
                    <div>
                      <div className="text-xs font-bold tracking-wider uppercase mb-0.5" style={{ color }}>
                        {plan.nameAr || plan.name}
                      </div>
                      {plan.nameAr && plan.name && (
                        <div className="text-[10px] text-white/30">{plan.name}</div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(plan)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-3xl font-black text-white"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      >
                        {Number(plan.price).toLocaleString("ar-IQ")}
                      </span>
                      <span className="text-xs font-medium" style={{ color: `${color}90` }}>{plan.currency}</span>
                    </div>
                    <div
                      className="text-xs mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: `${color}10`, color: `${color}90` }}
                    >
                      {DURATION_LABELS[plan.duration] || plan.duration}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-white/5">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${color}20` }}
                        >
                          <Check className="w-2.5 h-2.5" style={{ color }} />
                        </div>
                        <span className="text-xs text-white/70">{f}</span>
                      </div>
                    ))}
                    {(plan.excludedFeatures || []).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 opacity-35">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-white/5">
                          <X className="w-2.5 h-2.5 text-white/30" />
                        </div>
                        <span className="text-xs text-white/40 line-through">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="text-base font-bold text-white">{editPlan ? "تعديل باقة" : "إضافة باقة جديدة"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: `${A}99` }}>الاسم بالعربي</label>
                  <input
                    required
                    value={form.nameAr}
                    onChange={e => setForm({ ...form, nameAr: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                    placeholder="الباقة الأساسية"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: `${A}99` }}>الاسم بالإنجليزي</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                    placeholder="Basic"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: `${A}99` }}>السعر</label>
                  <input
                    required type="number" min="0" step="0.01"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                    placeholder="9999" dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: `${A}99` }}>العملة</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm({ ...form, currency: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none appearance-none"
                  >
                    <option value="IQD">IQD — دينار عراقي</option>
                    <option value="USD">USD — دولار</option>
                    <option value="SAR">SAR — ريال سعودي</option>
                    <option value="AED">AED — درهم إماراتي</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: `${A}99` }}>المدة</label>
                  <select
                    value={form.duration}
                    onChange={e => setForm({ ...form, duration: e.target.value })}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none appearance-none"
                  >
                    <option value="monthly">شهري</option>
                    <option value="quarterly">ربع سنوي (3 أشهر)</option>
                    <option value="yearly">سنوي</option>
                    <option value="lifetime">مدى الحياة</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isPopular: !f.isPopular }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all w-full justify-center"
                    style={form.isPopular
                      ? { background: `${A}15`, borderColor: `${A}40`, color: A }
                      : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
                  >
                    <Star className={`w-3.5 h-3.5 ${form.isPopular ? "fill-current" : ""}`} />
                    الأكثر طلباً
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium block" style={{ color: `${A}99` }}>المميزات المتضمنة</label>
                {form.features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={f}
                      onChange={e => updateFeature(i, e.target.value, "features")}
                      className="flex-1 bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                      placeholder="وصول كامل للتطبيقات..."
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(i, "features")}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addFeature("features")}
                  className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  style={{ color: A }}
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة ميزة
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium block text-red-400/70">
                  المميزات المستثناة <span className="text-white/30">(اختياري)</span>
                </label>
                {form.excludedFeatures.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={f}
                      onChange={e => updateFeature(i, e.target.value, "excludedFeatures")}
                      className="flex-1 bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                      placeholder="ميزة غير متضمنة..."
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(i, "excludedFeatures")}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addFeature("excludedFeatures")}
                  className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-red-400/50"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة ميزة مستثناة
                </button>
              </div>
            </form>

            <div className="border-t border-white/5 p-4 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit as any}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5 transition-all"
                style={{ background: A }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editPlan ? "حفظ التغييرات" : "إضافة الباقة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
