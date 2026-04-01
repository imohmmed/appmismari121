import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Plus, Trash2, Edit2, X, Loader2, Layers, Search, Grid, Check } from "lucide-react";
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

interface Category {
  id: number;
  name: string;
  nameAr: string | null;
  icon: string | null;
  appCount: number;
}

const FEATHER_ICONS = [
  "smartphone", "monitor", "tablet", "camera", "video", "music", "headphones",
  "image", "film", "tv", "radio", "mic", "volume-2", "speaker",
  "globe", "wifi", "cloud", "server", "database", "hard-drive", "cpu",
  "code", "terminal", "git-branch", "layers", "package", "box", "archive",
  "map", "navigation", "compass", "map-pin", "home", "building", "shop",
  "shopping-bag", "shopping-cart", "credit-card", "dollar-sign", "trending-up",
  "bar-chart-2", "pie-chart", "activity", "zap", "bolt", "star", "heart",
  "shield", "lock", "key", "eye", "user", "users", "user-check",
  "message-circle", "message-square", "mail", "send", "bell", "bookmark",
  "flag", "tag", "hash", "calendar", "clock", "timer", "watch",
  "coffee", "gift", "award", "trophy", "target", "crosshair",
  "settings", "tool", "wrench", "scissors", "edit", "pen-tool",
  "download", "upload", "share-2", "link", "external-link", "rss",
  "play-circle", "pause-circle", "skip-forward", "shuffle", "repeat",
  "sun", "moon", "cloud-rain", "wind", "umbrella", "thermometer",
  "book", "book-open", "file-text", "clipboard", "list",
  "search", "zoom-in", "filter", "sliders", "toggle-left",
  "gamepad", "joystick", "disc", "headphones", "music-2",
  "flash", "sparkles", "wand", "magic",
];

const EMOJI_ICONS = [
  "📱", "🎮", "🎵", "📸", "💬", "📁", "🌐", "⚡", "🔧", "🎯",
  "📊", "🎨", "🏥", "🛒", "📰", "🎬", "📺", "🔐", "💰", "🎁",
  "⭐", "🏆", "📚", "🔔", "🌙", "☀️", "🎪", "🧩", "🎲", "🔮",
];

const blankForm = { name: "", nameAr: "", icon: "smartphone", iconType: "feather" as "feather" | "emoji" };

function renderIcon(icon: string | null, color: string, size = 20) {
  if (!icon) return <Layers style={{ width: size, height: size, color }} />;
  if (icon.match(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[📱🎮🎵📸💬📁🌐⚡🔧🎯📊🎨🏥🛒📰🎬📺🔐💰🎁⭐🏆📚🔔🌙☀️🎪🧩🎲🔮]/u)) {
    return <span style={{ fontSize: size }}>{icon}</span>;
  }
  return <span className="font-mono text-xs opacity-60" style={{ color, fontSize: 10 }}>{icon}</span>;
}

function FeatherIconPreview({ name, color, size = 16 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="font-mono opacity-80 select-none"
      style={{ fontSize: 9, color, lineHeight: 1 }}
    >
      {name.length <= 6 ? name.substring(0, 6) : name.substring(0, 4) + ".."}
    </span>
  );
}

export default function AdminCategories() {
  usePageTitle("الأقسام");
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [iconTab, setIconTab] = useState<"feather" | "emoji">("feather");
  const [iconSearch, setIconSearch] = useState("");
  const [search, setSearch] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/categories");
    setCategories(d?.categories || []);
    setLoading(false);
  };
  useEffect(() => { fetchCategories(); }, []);

  const openAdd = () => {
    setForm(blankForm);
    setEditCat(null);
    setIconTab("feather");
    setIconSearch("");
    setModal("add");
  };
  const openEdit = (cat: Category) => {
    const isEmoji = cat.icon ? EMOJI_ICONS.includes(cat.icon) : false;
    setForm({
      name: cat.name,
      nameAr: cat.nameAr || "",
      icon: cat.icon || "smartphone",
      iconType: isEmoji ? "emoji" : "feather",
    });
    setEditCat(cat);
    setIconTab(isEmoji ? "emoji" : "feather");
    setIconSearch("");
    setModal("edit");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editCat) {
        await adminFetch(`/admin/categories/${editCat.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.name, nameAr: form.nameAr, icon: form.icon }),
        });
        toast({ title: "تم تحديث التصنيف" });
      } else {
        await adminFetch("/admin/categories", {
          method: "POST",
          body: JSON.stringify({ name: form.name, nameAr: form.nameAr, icon: form.icon }),
        });
        toast({ title: "تمت إضافة التصنيف" });
      }
      fetchCategories();
      setModal(null);
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا التصنيف؟")) return;
    await adminFetch(`/admin/categories/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" });
    fetchCategories();
  };

  const filteredFeather = FEATHER_ICONS.filter(ic => !iconSearch || ic.includes(iconSearch.toLowerCase()));
  const filteredEmoji = EMOJI_ICONS;
  const totalApps = categories.reduce((s, c) => s + c.appCount, 0);

  const filteredCats = search
    ? categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.nameAr || "").includes(search)
      )
    : categories;

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">الأقسام</h2>
            <p className="text-white/40 text-xs mt-0.5">أقسام التطبيقات في المتجر · {categories.length} قسم · {totalApps} تطبيق</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black"
            style={{ background: A }}
          >
            <Plus className="w-4 h-4" /> إضافة قسم
          </button>
        </div>

        {/* Search */}
        {categories.length > 4 && (
          <div className="relative max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث في الأقسام..."
              className="w-full bg-[#111111] border border-white/8 rounded-xl py-2 pr-9 pl-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/15"
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : filteredCats.length === 0 ? (
          <div className="bg-[#111111] rounded-2xl border border-white/8 py-20 text-center">
            <Grid className="w-8 h-8 mx-auto mb-3 text-white/10" />
            <p className="text-white/30 text-sm">{search ? "لا توجد نتائج" : "لا توجد أقسام بعد"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCats.map((cat, idx) => {
              const colors = [A, "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];
              const color = colors[idx % colors.length];
              return (
                <div
                  key={cat.id}
                  className="bg-[#111111] rounded-xl border border-white/8 p-5 group relative overflow-hidden hover:border-white/15 transition-all"
                >
                  <div className="absolute top-0 left-0 w-1 h-full rounded-r-lg" style={{ background: color }} />
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${color}15` }}
                    >
                      {cat.icon && EMOJI_ICONS.includes(cat.icon)
                        ? <span style={{ fontSize: 22 }}>{cat.icon}</span>
                        : <Layers className="w-5 h-5" style={{ color }} />
                      }
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-white font-semibold text-sm truncate">{cat.nameAr || cat.name}</p>
                  {cat.nameAr && <p className="text-white/35 text-xs truncate mt-0.5">{cat.name}</p>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3 h-3" style={{ color: `${color}80` }} />
                      <span className="text-xs" style={{ color: `${color}80` }}>{cat.appCount} تطبيق</span>
                    </div>
                    {cat.icon && !EMOJI_ICONS.includes(cat.icon) && (
                      <span className="text-[10px] font-mono text-white/25">{cat.icon}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="text-base font-bold text-white">{editCat ? "تعديل قسم" : "إضافة قسم جديد"}</h3>
              <button
                onClick={() => setModal(null)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>الاسم بالعربي</label>
                <input
                  required
                  value={form.nameAr}
                  onChange={e => setForm({ ...form, nameAr: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                  placeholder="تطبيقات بلس"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>الاسم بالإنجليزي</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                  placeholder="Plus Apps"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: `${A}99` }}>الأيقونة</label>
                  <div className="flex gap-1 bg-black rounded-lg p-0.5 border border-white/10">
                    {(["feather", "emoji"] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setIconTab(tab)}
                        className="px-2.5 py-1 rounded-md text-xs transition-all"
                        style={iconTab === tab
                          ? { background: `${A}20`, color: A }
                          : { color: "rgba(255,255,255,0.3)" }
                        }
                      >
                        {tab === "feather" ? "أيقونات" : "إيموجي"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current icon preview */}
                <div className="flex items-center gap-3 p-3 bg-black rounded-lg border border-white/8">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${A}15` }}>
                    {form.iconType === "emoji"
                      ? <span style={{ fontSize: 22 }}>{form.icon}</span>
                      : <Layers className="w-5 h-5" style={{ color: A }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/60">الأيقونة المختارة</p>
                    <p className="text-sm font-medium text-white truncate font-mono">{form.icon}</p>
                  </div>
                </div>

                {iconTab === "feather" ? (
                  <>
                    <div className="relative">
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                      <input
                        value={iconSearch}
                        onChange={e => setIconSearch(e.target.value)}
                        placeholder="بحث في الأيقونات..."
                        className="w-full bg-black border border-white/10 rounded-lg py-1.5 pr-7 pl-3 text-xs text-white focus:outline-none placeholder-white/20"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto pr-1">
                      {filteredFeather.map(ic => (
                        <button
                          key={ic}
                          type="button"
                          title={ic}
                          onClick={() => setForm({ ...form, icon: ic, iconType: "feather" })}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all relative"
                          style={form.icon === ic && form.iconType === "feather"
                            ? { background: `${A}25`, boxShadow: `0 0 0 1.5px ${A}` }
                            : { background: "rgba(255,255,255,0.04)" }
                          }
                        >
                          <FeatherIconPreview name={ic} color={form.icon === ic ? A : "rgba(255,255,255,0.4)"} />
                          {form.icon === ic && form.iconType === "feather" && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center" style={{ background: A }}>
                              <Check className="w-2 h-2 text-black" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 block mb-1">أو أدخل اسم أيقونة Feather مخصص:</label>
                      <input
                        value={form.iconType === "feather" ? form.icon : ""}
                        onChange={e => setForm({ ...form, icon: e.target.value, iconType: "feather" })}
                        placeholder="smartphone"
                        className="w-full bg-black border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white focus:border-white/20 focus:outline-none font-mono"
                        dir="ltr"
                      />
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto">
                    {filteredEmoji.map(ic => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setForm({ ...form, icon: ic, iconType: "emoji" })}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xl transition-all"
                        style={form.icon === ic && form.iconType === "emoji"
                          ? { background: `${A}25`, boxShadow: `0 0 0 1.5px ${A}` }
                          : { background: "rgba(255,255,255,0.05)" }
                        }
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </form>

            <div className="border-t border-white/5 p-4 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSubmit as any}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5 transition-all"
                style={{ background: A }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editCat ? "حفظ" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
