import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronRight, ChevronLeft, MessageCircle, ShoppingBag, Loader2, X, ArrowRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const A = "#9fbcff";
const TEXT = "#2b283b";
const BG = "#ffffff";
const CARD = "#f4f5f8";
const BORDER = "#e8eaf0";

interface Product {
  id: number; name: string; description: string | null; price: string | null;
  imageList: string[]; categoryId: number; createdAt: string;
}
interface Category { id: number; name: string; }

function ImageGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) {
    return (
      <div className="rounded-2xl flex items-center justify-center" style={{ aspectRatio: "4/5", background: CARD, border: `1px solid ${BORDER}` }}>
        <ShoppingBag className="w-16 h-16" style={{ color: `${TEXT}18` }} />
      </div>
    );
  }

  const prev = () => setActive(i => (i - 1 + images.length) % images.length);
  const next = () => setActive(i => (i + 1) % images.length);

  return (
    <div className="space-y-3">
      <div
        className="relative rounded-2xl overflow-hidden cursor-zoom-in group"
        style={{ aspectRatio: "4/5", border: `1px solid ${BORDER}` }}
        onClick={() => setLightbox(true)}
      >
        <img src={images[active]} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        {images.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={e => { e.stopPropagation(); next(); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: "rgba(0,0,0,0.45)", color: "#fff" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setActive(i); }}
                  className="rounded-full transition-all"
                  style={{ width: i === active ? 20 : 6, height: 6, background: i === active ? A : "rgba(255,255,255,0.6)" }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="rounded-xl overflow-hidden border-2 transition-all shrink-0"
              style={{ aspectRatio: "4/5", width: 56, borderColor: i === active ? A : BORDER }}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
          <img src={images[active]} alt="" className="max-h-full max-w-full object-contain rounded-xl" onClick={e => e.stopPropagation()} />
          {images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
                <ChevronRight className="w-5 h-5" />
              </button>
              <button onClick={e => { e.stopPropagation(); next(); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RelatedCard({ product }: { product: any }) {
  const [, nav] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const img = product.imageList?.[0] || null;
  return (
    <button
      onClick={() => nav(`${base}/products/${product.id}`)}
      className="rounded-xl overflow-hidden transition-all text-right group"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div style={{ aspectRatio: "4/5" }} className="overflow-hidden">
        {img
          ? <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: CARD }}><ShoppingBag className="w-6 h-6" style={{ color: `${TEXT}20` }} /></div>
        }
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold line-clamp-2" style={{ color: TEXT }}>{product.name}</p>
        {product.price && <p className="text-xs font-bold mt-1" style={{ color: A }}>{product.price}</p>}
      </div>
    </button>
  );
}

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const [data, setData] = useState<{ product: Product; category: Category | null; related: any[]; whatsapp: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/products/${params.id}`)
      .then(r => { if (r.status === 404) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then(d => { if (d) setData(d); setLoading(false); })
      .catch(() => { setLoading(false); setNotFound(true); });
  }, [params.id]);

  const handleWhatsApp = () => {
    if (!data) return;
    const phone = data.whatsapp.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(`مرحباً، أريد الاستفسار عن: ${data.product.name}`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: `${TEXT}30` }} />
    </div>
  );

  if (notFound || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4" style={{ background: BG }}>
      <ShoppingBag className="w-12 h-12" style={{ color: `${TEXT}18` }} />
      <p className="text-lg" style={{ color: `${TEXT}60` }}>المنتج غير موجود</p>
      <button onClick={() => nav(`${base}/`)} className="text-sm px-4 py-2 rounded-xl transition-colors" style={{ border: `1px solid ${BORDER}`, color: `${TEXT}60` }}>
        العودة للرئيسية
      </button>
    </div>
  );

  const { product, category, related, whatsapp } = data;

  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT }} dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-30 backdrop-blur-md" style={{ background: `${BG}ee`, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => nav(`${base}/`)} className="p-2 rounded-xl transition-colors" style={{ color: `${TEXT}50` }}>
            <ArrowRight className="w-4 h-4" />
          </button>
          {category && (
            <>
              <span className="text-sm" style={{ color: `${TEXT}30` }}>/</span>
              <span className="text-sm" style={{ color: `${TEXT}50` }}>{category.name}</span>
              <span className="text-sm" style={{ color: `${TEXT}30` }}>/</span>
            </>
          )}
          <span className="text-sm font-semibold truncate flex-1" style={{ color: TEXT }}>{product.name}</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Gallery */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ImageGallery images={product.imageList} />
          </div>

          {/* Info */}
          <div className="space-y-5">
            {category && (
              <span className="inline-block text-xs px-2.5 py-1 rounded-lg" style={{ background: `${A}18`, color: A }}>
                {category.name}
              </span>
            )}

            <div>
              <h1 className="text-2xl font-bold leading-snug" style={{ color: TEXT }}>{product.name}</h1>

              {/* Description — directly below product name */}
              {product.description && (
                <div
                  className="mt-3 prose prose-sm max-w-none leading-relaxed"
                  style={{ direction: "rtl", color: `${TEXT}bb` }}
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}

              {product.price && (
                <p className="text-3xl font-black mt-4" style={{ color: A }}>{product.price}</p>
              )}
            </div>

            {/* WhatsApp button */}
            {whatsapp && (
              <button
                onClick={handleWhatsApp}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-white text-base transition-all active:scale-95"
                style={{ background: "#25D366", boxShadow: "0 4px 24px #25D36630" }}
              >
                <MessageCircle className="w-5 h-5" />
                اشتري عبر واتساب
              </button>
            )}
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-lg font-bold mb-5" style={{ color: TEXT }}>منتجات مشابهة</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {related.map(r => <RelatedCard key={r.id} product={r} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
