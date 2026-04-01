import { useState, useEffect, useRef, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Plus, Trash2, Edit2, X, Loader2, Search, Check, ShoppingBag,
  Image as ImageIcon, Tag, ChevronDown, Eye, EyeOff, Layers, Bold,
  Italic, List, ListOrdered, Heading2, Link as LinkIcon, AlignRight,
  Underline, Strikethrough, AlignLeft, AlignCenter, Highlighter, Type,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";

async function adminFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: { ...(opts?.headers || {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
    throw new Error("غير مصرح - سيتم تحويلك لتسجيل الدخول");
  }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `خطأ ${res.status}`);
  return data;
}

async function adminUpload(path: string, formData: FormData) {
  const token = localStorage.getItem("adminToken") || "";
  const res = await fetch(`${API}/api${path}`, {
    method: "POST",
    headers: { "x-admin-token": token },
    body: formData,
  });
  return res.json();
}

interface Category { id: number; name: string; sortOrder: number; }
interface Product {
  id: number; categoryId: number; name: string; description: string | null;
  price: string | null; images: string | null; isHidden: boolean; createdAt: string;
}

/* ─── Rich Text Editor ──────────────────────────────────────────────────── */
const TEXT_COLORS = [
  "#ffffff", "#d1d5db", "#9ca3af", "#6b7280",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#9fbcff", "#a855f7", "#ec4899",
  "#000000", "#1e293b", "#0f172a", "#78716c",
];
const HIGHLIGHT_COLORS = [
  "transparent", "#fef08a", "#bbf7d0", "#bfdbfe",
  "#fecaca", "#e9d5ff", "#fed7aa", "#f9a8d4",
];

function ToolBtn({ title, onMouseDown, active, children }: {
  title: string; onMouseDown: (e: React.MouseEvent) => void;
  active?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      className="p-1.5 rounded-md transition-colors flex items-center justify-center text-[11px] font-bold min-w-[26px]"
      style={{ color: active ? "#fff" : "rgba(255,255,255,0.45)", background: active ? "rgba(159,188,255,0.18)" : "transparent" }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 mx-0.5 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />;
}

/** Strip dangerous tags/attributes before setting innerHTML in the rich editor */
function sanitizeEditorHtml(dirty: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = dirty;
  const BANNED_TAGS = ["script", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "base"];
  const BANNED_ATTRS = /^on|^javascript|^vbscript|^data:/i;
  BANNED_TAGS.forEach(tag => tmp.querySelectorAll(tag).forEach(el => el.remove()));
  tmp.querySelectorAll("*").forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (BANNED_ATTRS.test(attr.name) || BANNED_ATTRS.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return tmp.innerHTML;
}

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [activeColor, setActiveColor] = useState("#ffffff");
  const [activeHighlight, setActiveHighlight] = useState("transparent");

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = sanitizeEditorHtml(value);
    }
  }, []);

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    handleInput();
  };

  const setTextColor = (color: string) => {
    setActiveColor(color);
    setShowTextColors(false);
    exec("foreColor", color);
  };

  const setHighlight = (color: string) => {
    setActiveHighlight(color);
    setShowHighlight(false);
    exec("hiliteColor", color === "transparent" ? "transparent" : color);
  };

  const setFontSize = (size: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    ref.current?.focus();
    const range = sel.getRangeAt(0);
    if (!range.collapsed) {
      document.execCommand("fontSize", false, "7");
      const spans = ref.current?.querySelectorAll('font[size="7"]') || [];
      spans.forEach(el => {
        const s = el as HTMLElement;
        s.removeAttribute("size");
        s.style.fontSize = size;
      });
    } else {
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.innerHTML = "&#8203;";
      range.insertNode(span);
      range.setStartAfter(span);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    handleInput();
  };

  const insertLink = () => {
    const url = prompt("أدخل الرابط:");
    if (url) exec("createLink", url);
  };

  const fontSizes = [
    { label: "S", size: "12px", title: "صغير" },
    { label: "M", size: "15px", title: "متوسط" },
    { label: "L", size: "19px", title: "كبير" },
    { label: "XL", size: "24px", title: "كبير جداً" },
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "#0a0a0a" }}>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#111" }}>

        {/* Format */}
        <ToolBtn title="عريض" onMouseDown={e => { e.preventDefault(); exec("bold"); }}><Bold className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="مائل" onMouseDown={e => { e.preventDefault(); exec("italic"); }}><Italic className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="تسطير" onMouseDown={e => { e.preventDefault(); exec("underline"); }}><Underline className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="يتوسطه خط" onMouseDown={e => { e.preventDefault(); exec("strikeThrough"); }}><Strikethrough className="w-3.5 h-3.5" /></ToolBtn>

        <Sep />

        {/* Headings */}
        <ToolBtn title="عنوان H2" onMouseDown={e => { e.preventDefault(); exec("formatBlock", "h2"); }}>H2</ToolBtn>
        <ToolBtn title="عنوان H3" onMouseDown={e => { e.preventDefault(); exec("formatBlock", "h3"); }}>H3</ToolBtn>
        <ToolBtn title="نص عادي" onMouseDown={e => { e.preventDefault(); exec("formatBlock", "p"); }}><Type className="w-3.5 h-3.5" /></ToolBtn>

        <Sep />

        {/* Font sizes */}
        {fontSizes.map(f => (
          <ToolBtn key={f.label} title={f.title} onMouseDown={e => { e.preventDefault(); setFontSize(f.size); }}>
            {f.label}
          </ToolBtn>
        ))}

        <Sep />

        {/* Alignment */}
        <ToolBtn title="محاذاة يمين" onMouseDown={e => { e.preventDefault(); exec("justifyRight"); }}><AlignRight className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="توسيط" onMouseDown={e => { e.preventDefault(); exec("justifyCenter"); }}><AlignCenter className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="محاذاة يسار" onMouseDown={e => { e.preventDefault(); exec("justifyLeft"); }}><AlignLeft className="w-3.5 h-3.5" /></ToolBtn>

        <Sep />

        {/* Lists */}
        <ToolBtn title="قائمة نقطية" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}><List className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="قائمة مرقمة" onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>

        <Sep />

        {/* Link */}
        <ToolBtn title="رابط" onMouseDown={e => { e.preventDefault(); insertLink(); }}><LinkIcon className="w-3.5 h-3.5" /></ToolBtn>

        <Sep />

        {/* Text Color */}
        <div className="relative">
          <button
            type="button"
            title="لون النص"
            onMouseDown={e => { e.preventDefault(); setShowTextColors(v => !v); setShowHighlight(false); }}
            className="flex flex-col items-center p-1.5 rounded-md hover:bg-white/10 transition-colors gap-0.5"
          >
            <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>A</span>
            <div className="w-4 h-1 rounded-full" style={{ background: activeColor }} />
          </button>
          {showTextColors && (
            <div className="absolute top-full mt-1 right-0 z-50 p-2 rounded-xl shadow-2xl" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", minWidth: 128 }}>
              <p className="text-[9px] text-white/30 mb-1.5 text-right">لون النص</p>
              <div className="grid grid-cols-4 gap-1">
                {TEXT_COLORS.map(c => (
                  <button key={c} type="button"
                    onMouseDown={e => { e.preventDefault(); setTextColor(c); }}
                    className="w-6 h-6 rounded-md transition-transform hover:scale-110"
                    style={{ background: c, border: c === activeColor ? "2px solid #9fbcff" : "1px solid rgba(255,255,255,0.12)" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlight Color */}
        <div className="relative">
          <button
            type="button"
            title="تظليل النص"
            onMouseDown={e => { e.preventDefault(); setShowHighlight(v => !v); setShowTextColors(false); }}
            className="flex flex-col items-center p-1.5 rounded-md hover:bg-white/10 transition-colors gap-0.5"
          >
            <Highlighter className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.5)" }} />
            <div className="w-4 h-1 rounded-full" style={{ background: activeHighlight === "transparent" ? "rgba(255,255,255,0.15)" : activeHighlight }} />
          </button>
          {showHighlight && (
            <div className="absolute top-full mt-1 right-0 z-50 p-2 rounded-xl shadow-2xl" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", minWidth: 120 }}>
              <p className="text-[9px] text-white/30 mb-1.5 text-right">تظليل</p>
              <div className="grid grid-cols-4 gap-1">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} type="button"
                    onMouseDown={e => { e.preventDefault(); setHighlight(c); }}
                    className="w-6 h-6 rounded-md transition-transform hover:scale-110"
                    style={{
                      background: c === "transparent" ? "transparent" : c,
                      border: c === activeHighlight ? "2px solid #9fbcff" : "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    {c === "transparent" && <X className="w-3 h-3 m-auto" style={{ color: "rgba(255,255,255,0.3)" }} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Sep />

        {/* Clear */}
        <ToolBtn title="مسح التنسيق" onMouseDown={e => { e.preventDefault(); exec("removeFormat"); }}>
          <span className="text-[10px]">مسح</span>
        </ToolBtn>
      </div>

      {/* ── Editor Area ── */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir="rtl"
        onInput={handleInput}
        onClick={() => { setShowTextColors(false); setShowHighlight(false); }}
        className="min-h-[160px] p-3 text-sm text-white focus:outline-none leading-relaxed"
        style={{ direction: "rtl" }}
      />
    </div>
  );
}

/* ─── Image Upload Row ───────────────────────────────────────────────────── */
function ImageSlot({ index, src, onUpload, onRemove }: {
  index: number; src: string | null; onUpload: (idx: number, file: File) => void; onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer border-2 border-dashed transition-all"
      style={{ aspectRatio: "4/5", borderColor: src ? "transparent" : "rgba(255,255,255,0.12)" }}
      onClick={() => !src && inputRef.current?.click()}
    >
      {src ? (
        <>
          <img src={src} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100 gap-2">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
              className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(index); }}
              className="p-1.5 bg-red-500/80 backdrop-blur-sm rounded-lg text-white hover:bg-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white/20 hover:text-white/40 transition-colors">
          <ImageIcon className="w-6 h-6" />
          <span className="text-[10px]">4:5</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(index, f); e.target.value = ""; }}
      />
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function AdminProducts() {
  usePageTitle("المنتجات");
  const { toast } = useToast();
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<number | null>(null);

  // Product modal
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [pName, setPName] = useState("");
  const [pCatId, setPCatId] = useState<number | "">("");
  const [pPrice, setPPrice] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pImages, setPImages] = useState<(string | null)[]>([null, null, null, null]);
  const [pHidden, setPHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  // Category modal
  const [catModal, setCatModal] = useState<"add" | "edit" | null>(null);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const d = await adminFetch("/admin/products");
    setProducts(d?.products || []);
    setCategories(d?.categories || []);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  /* products modal */
  const openAdd = () => {
    setPName(""); setPCatId(categories[0]?.id || ""); setPPrice(""); setPDesc("");
    setPImages([null, null, null, null]); setPHidden(false); setEditProd(null); setModal("add");
  };
  const openEdit = (p: Product) => {
    let imgs: (string | null)[] = [null, null, null, null];
    try { const parsed = JSON.parse(p.images || "[]"); imgs = [...parsed, null, null, null, null].slice(0, 4); } catch {}
    setPName(p.name); setPCatId(p.categoryId); setPPrice(p.price || ""); setPDesc(p.description || "");
    setPImages(imgs); setPHidden(p.isHidden); setEditProd(p); setModal("edit");
  };

  const handleImageUpload = async (idx: number, file: File) => {
    setUploadingSlot(idx);
    const fd = new FormData();
    fd.append("image", file);
    const d = await adminUpload("/admin/products/upload-image", fd);
    setUploadingSlot(null);
    if (d?.url) {
      setPImages(prev => { const n = [...prev]; n[idx] = d.urlPath; return n; });
    } else {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    }
  };

  const handleSaveProd = async () => {
    if (!pName.trim() || !pCatId) { toast({ title: "أدخل الاسم والتصنيف", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const imageList = pImages.filter(Boolean) as string[];
      const body = { name: pName, categoryId: pCatId, price: pPrice, description: pDesc, images: imageList, isHidden: pHidden };
      if (editProd) {
        await adminFetch(`/admin/products/${editProd.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: "تم تحديث المنتج" });
      } else {
        await adminFetch("/admin/products", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "تمت إضافة المنتج" });
      }
      setModal(null); fetchAll();
    } catch (e: any) {
      toast({ title: e?.message || "فشل الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProd = async (id: number) => {
    if (!confirm("حذف هذا المنتج؟")) return;
    await adminFetch(`/admin/products/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" }); fetchAll();
  };

  const toggleHidden = async (p: Product) => {
    await adminFetch(`/admin/products/${p.id}`, { method: "PUT", body: JSON.stringify({ isHidden: !p.isHidden }) });
    fetchAll();
  };

  /* category modal */
  const openCatAdd = () => { setCatName(""); setEditCat(null); setCatModal("add"); };
  const openCatEdit = (c: Category) => { setCatName(c.name); setEditCat(c); setCatModal("edit"); };
  const handleSaveCat = async () => {
    if (!catName.trim()) { toast({ title: "أدخل الاسم", variant: "destructive" }); return; }
    setCatSaving(true);
    try {
      if (editCat) {
        await adminFetch(`/admin/product-categories/${editCat.id}`, { method: "PUT", body: JSON.stringify({ name: catName }) });
        toast({ title: "تم تحديث التصنيف" });
      } else {
        await adminFetch("/admin/product-categories", { method: "POST", body: JSON.stringify({ name: catName }) });
        toast({ title: "تمت الإضافة" });
      }
      setCatModal(null); fetchAll();
    } catch (e: any) {
      toast({ title: e?.message || "فشل الحفظ", variant: "destructive" });
    } finally {
      setCatSaving(false);
    }
  };
  const handleDeleteCat = async (id: number) => {
    if (!confirm("حذف هذا التصنيف؟")) return;
    await adminFetch(`/admin/product-categories/${id}`, { method: "DELETE" });
    toast({ title: "تم الحذف" }); fetchAll();
  };

  const getCatName = (id: number) => categories.find(c => c.id === id)?.name || "—";
  const getFirstImage = (p: Product) => {
    try { const a = JSON.parse(p.images || "[]"); return a[0] || null; } catch { return null; }
  };

  const filtered = products.filter(p => {
    if (filterCat && p.categoryId !== filterCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="space-y-5" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">المنتجات</h2>
            <p className="text-white/40 text-xs mt-0.5">{products.length} منتج · {categories.length} تصنيف</p>
          </div>
          <button
            onClick={tab === "products" ? openAdd : openCatAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black"
            style={{ background: A }}
          >
            <Plus className="w-4 h-4" />
            {tab === "products" ? "إضافة منتج" : "إضافة تصنيف"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#111] rounded-xl p-1 border border-white/8 w-fit">
          {(["products", "categories"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={tab === t ? { background: `${A}20`, color: A } : { color: "rgba(255,255,255,0.35)" }}
            >
              {t === "products" ? "المنتجات" : "التصنيفات"}
            </button>
          ))}
        </div>

        {/* Products Tab */}
        {tab === "products" && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="بحث في المنتجات..."
                  className="bg-[#111] border border-white/8 rounded-xl py-2 pr-9 pl-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/15 w-48"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterCat(null)}
                  className="px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={!filterCat ? { background: `${A}20`, color: A } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                >
                  الكل
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
                    className="px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={filterCat === c.id ? { background: `${A}20`, color: A } : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
            ) : filtered.length === 0 ? (
              <div className="bg-[#111] rounded-2xl border border-white/8 py-20 text-center">
                <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm">لا توجد منتجات</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map(p => {
                  const img = getFirstImage(p);
                  return (
                    <div key={p.id} className="bg-[#111] rounded-xl border border-white/8 overflow-hidden group hover:border-white/15 transition-all">
                      <div className="relative" style={{ aspectRatio: "4/5" }}>
                        {img
                          ? <img src={`${API}${img}`} alt={p.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-white/5"><ImageIcon className="w-8 h-8 text-white/10" /></div>
                        }
                        {p.isHidden && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <EyeOff className="w-6 h-6 text-white/40" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => toggleHidden(p)} className="p-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-white/60 hover:text-white transition-colors">
                            {p.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => openEdit(p)} className="p-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-white/60 hover:text-white transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteProd(p.id)} className="p-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-red-400/80 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[11px] text-white/35">{getCatName(p.categoryId)}</span>
                          {p.price && <span className="text-xs font-bold" style={{ color: A }}>{p.price}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Categories Tab */}
        {tab === "categories" && (
          <>
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
            ) : categories.length === 0 ? (
              <div className="bg-[#111] rounded-2xl border border-white/8 py-20 text-center">
                <Tag className="w-8 h-8 mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm">لا توجد تصنيفات</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map((c, i) => {
                  const colors = [A, "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
                  const color = colors[i % colors.length];
                  const cnt = products.filter(p => p.categoryId === c.id).length;
                  return (
                    <div key={c.id} className="bg-[#111] rounded-xl border border-white/8 p-4 group hover:border-white/15 transition-all relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-1 h-full" style={{ background: color }} />
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                          <Tag className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openCatEdit(c)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteCat(c.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-white font-semibold text-sm mt-3">{c.name}</p>
                      <p className="text-white/35 text-xs mt-1">{cnt} منتج</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <h3 className="text-base font-bold text-white">{editProd ? "تعديل المنتج" : "إضافة منتج جديد"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>اسم المنتج</label>
                <input
                  value={pName} onChange={e => setPName(e.target.value)} required
                  className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                  placeholder="اسم المنتج..."
                />
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>التصنيف</label>
                  <div className="relative">
                    <select
                      value={pCatId}
                      onChange={e => setPCatId(Number(e.target.value))}
                      className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none appearance-none"
                    >
                      <option value="">اختر تصنيف</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>السعر</label>
                  <input
                    value={pPrice} onChange={e => setPPrice(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                    placeholder="مثال: 99 ريال"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Images */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: `${A}99` }}>
                  الصور (4:5) — حتى 4 صور
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {pImages.map((src, i) => (
                    <div key={i} className="relative">
                      {uploadingSlot === i && (
                        <div className="absolute inset-0 bg-black/70 rounded-xl flex items-center justify-center z-10">
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: A }} />
                        </div>
                      )}
                      <ImageSlot
                        index={i}
                        src={src ? `${API}${src}` : null}
                        onUpload={handleImageUpload}
                        onRemove={idx => { setPImages(prev => { const n = [...prev]; n[idx] = null; return n; }); }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>الوصف</label>
                <RichEditor value={pDesc} onChange={setPDesc} />
              </div>

              {/* Hidden toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPHidden(!pHidden)}
                  className="w-10 h-5 rounded-full transition-all relative shrink-0"
                  style={{ background: pHidden ? "rgba(255,255,255,0.1)" : `${A}40` }}
                >
                  <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ background: pHidden ? "rgba(255,255,255,0.3)" : A, right: pHidden ? "auto" : "2px", left: pHidden ? "2px" : "auto" }} />
                </button>
                <span className="text-sm text-white/50">{pHidden ? "مخفي من المتجر" : "مرئي في المتجر"}</span>
              </div>
            </div>
            <div className="border-t border-white/5 p-4 flex justify-end gap-2 shrink-0">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                إلغاء
              </button>
              <button
                onClick={handleSaveProd}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: A }}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editProd ? "حفظ" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-base font-bold text-white">{editCat ? "تعديل التصنيف" : "إضافة تصنيف"}</h3>
              <button onClick={() => setCatModal(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <label className="text-xs font-medium block mb-1.5" style={{ color: `${A}99` }}>الاسم</label>
              <input
                value={catName} onChange={e => setCatName(e.target.value)}
                autoFocus
                className="w-full bg-black border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-white/20 focus:outline-none"
                placeholder="اسم التصنيف..."
              />
            </div>
            <div className="border-t border-white/5 p-4 flex justify-end gap-2">
              <button onClick={() => setCatModal(null)} className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm">
                إلغاء
              </button>
              <button
                onClick={handleSaveCat}
                disabled={catSaving}
                className="px-5 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: A }}
              >
                {catSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editCat ? "حفظ" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
