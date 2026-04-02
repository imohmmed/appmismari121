import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Plus, Trash2, Edit2, X, Loader2, Layers, Search, Grid, Check, ImageIcon, Upload } from "lucide-react";
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

async function uploadImage(file: File): Promise<string> {
  const token = localStorage.getItem("adminToken") || "";
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${API}/api/admin/upload-banner`, {
    method: "POST",
    headers: { "x-admin-token": token },
    body: fd,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.url;
}

interface Category {
  id: number;
  name: string;
  nameAr: string | null;
  icon: string | null;
  appCount: number;
  bannerImage?: string | null;
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

const blankForm = {
  name: "",
  nameAr: "",
  icon: "smartphone",
  iconType: "feather" as "feather" | "emoji",
  bannerImage: "" as string,
};

function FeatherIconPreview({ name, color }: { name: string; color: string }) {
  return (
    <span className="font-mono opacity-80 select-none" style={{ fontSize: 9, color, lineHeight: 1 }}>
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
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      bannerImage: cat.bannerImage || "",
    });
    setEditCat(cat);
    setIconTab(isEmoji ? "emoji" : "feather");
    setIconSearch("");
    setModal("edit");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadImage(file);
      setForm(f => ({ ...f, bannerImage: url }));
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    }
    setUploadingImg(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        nameAr: form.nameAr,
        icon: form.icon,
        bannerImage: form.bannerImage || null,
      };
      if (editCat) {
        await adminFetch(`/admin/categories/${editCat.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast({ title: "تم تحديث التصنيف" });
      } else {
        await adminFetch("/admin/categories", {
          method: "POST",
          body: JSON.stringify(body),
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
                  className="bg-[#111111] rounded-xl border border-white/8 group relative overflow-hidden hover:border-white/15 transition-all"
                >
                  {cat.bannerImage ? (
                    <div className="relative h-20 overflow-hidden">
                      <img src={cat.bannerImage} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40" />
                      <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white transition-colors">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute top-0 left-0 w-1 h-full rounded-r-lg" style={{ background: color }} />
                  )}
                  <div className="p-4">
                    {!cat.bannerImage && (
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${color}15` }}>
                          {cat.icon && EMOJI_ICONS.includes(cat.icon)
                            ? <span style={{ fontSize: 20 }}>{cat.icon}</span>
                            : <Layers className="w-4 h-4" style={{ color }} />
                          }
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-white font-semibold text-sm truncate">{cat.nameAr || cat.name}</p>
                    {cat.nameAr && <p className="text-white/35 text-xs truncate mt-0.5">{cat.name}</p>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3 h-3" style={{ color: `${color}80` }} />
                        <span className="text-xs" style={{ color: `${color}80` }}>{cat.appCount} تطبيق</span>
                      </div>
                      {cat.bannerImage && (
                        <ImageIcon className="w-3 h-3 text-white/20" />
                      )}
                    </div>
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
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
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
                  placeholder="تصميم"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>الاسم بالإنجليزي</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                  placeholder="Design"
                  dir="ltr"
                />
              </div>

              {/* Banner Image Upload */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>
                  صورة البانر (16:9) — اختياري
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                {form.bannerImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10" style={{ aspectRatio: "16/9" }}>
                    <img src={form.bannerImage} alt="banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-black/60 hover:bg-black/80 transition-colors"
                      >
                        تغيير
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, bannerImage: "" }))}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-black/60 hover:bg-black/80 transition-colors"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                    className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border border-dashed border-white/15 hover:border-white/30 transition-all text-white/30 hover:text-white/50"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {uploadingImg ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6" />
                        <span className="text-xs">ارفع صورة 16:9</span>
                        <span className="text-[10px] opacity-50">JPG · PNG · WebP</span>
                      </>
                    )}
                  </button>
                )}
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
                    <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto pr-1">
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
                    {EMOJI_ICONS.map(ic => (
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
                disabled={saving || uploadingImg}
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
