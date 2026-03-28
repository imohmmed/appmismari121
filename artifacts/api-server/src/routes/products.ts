import { Router, type IRouter } from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, productCategoriesTable, productsTable, settingsTable } from "@workspace/db";
import { adminAuth } from "../middleware/adminAuth";

const router: IRouter = Router();

const productImagesDir = path.join(process.cwd(), "uploads", "product-images");
if (!fs.existsSync(productImagesDir)) fs.mkdirSync(productImagesDir, { recursive: true });

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productImagesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const imageUpload = multer({ storage: imageStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use("/admin/products/image", (req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
});

router.get("/admin/products/image/:filename", (req, res): void => {
  const filePath = path.join(productImagesDir, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filePath);
});

router.post("/admin/products/upload-image", adminAuth, imageUpload.single("image"), (req, res): void => {
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "localhost";
  const url = `${proto}://${host}/api/admin/products/image/${req.file.filename}`;
  const urlPath = `/api/admin/products/image/${req.file.filename}`;
  res.json({ url, urlPath, filename: req.file.filename });
});

/* ─── PUBLIC: list products ───────────────────────────────────────────────── */
router.get("/products", async (req, res): Promise<void> => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        images: productsTable.images,
        categoryId: productsTable.categoryId,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .where(
        categoryId
          ? and(eq(productsTable.categoryId, categoryId), eq(productsTable.isHidden, false))
          : eq(productsTable.isHidden, false)
      )
      .orderBy(desc(productsTable.createdAt));
    const categories = await db.select().from(productCategoriesTable).orderBy(asc(productCategoriesTable.sortOrder));
    res.json({ products: products.map(p => resolveProductImages(req, p)), categories });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get("/products/:id", async (req, res): Promise<void> => {
  try {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, Number(req.params.id)))
      .limit(1);
    if (!product || product.isHidden) { res.status(404).json({ error: "Not found" }); return; }
    const [category] = await db
      .select()
      .from(productCategoriesTable)
      .where(eq(productCategoriesTable.id, product.categoryId))
      .limit(1);
    const related = await db
      .select({ id: productsTable.id, name: productsTable.name, price: productsTable.price, images: productsTable.images })
      .from(productsTable)
      .where(eq(productsTable.categoryId, product.categoryId))
      .orderBy(desc(productsTable.createdAt))
      .limit(6);
    const settings = await db.select().from(settingsTable);
    const whatsapp = settings.find(s => s.key === "support_whatsapp")?.value || "";
    res.json({
      product: resolveProductImages(req, product),
      category: category || null,
      related: related.filter(r => r.id !== product.id).map(r => resolveProductImages(req, r)),
      whatsapp,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ─── ADMIN: categories ───────────────────────────────────────────────────── */
router.get("/admin/product-categories", adminAuth, async (_req, res): Promise<void> => {
  const cats = await db.select().from(productCategoriesTable).orderBy(asc(productCategoriesTable.sortOrder));
  res.json({ categories: cats });
});

router.post("/admin/product-categories", adminAuth, async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const [cat] = await db.insert(productCategoriesTable).values({ name: name.trim() }).returning();
  res.json({ category: cat });
});

router.put("/admin/product-categories/:id", adminAuth, async (req, res): Promise<void> => {
  const { name, sortOrder } = req.body;
  const [cat] = await db
    .update(productCategoriesTable)
    .set({ ...(name !== undefined && { name }), ...(sortOrder !== undefined && { sortOrder }) })
    .where(eq(productCategoriesTable.id, Number(req.params.id)))
    .returning();
  res.json({ category: cat });
});

router.delete("/admin/product-categories/:id", adminAuth, async (req, res): Promise<void> => {
  await db.delete(productCategoriesTable).where(eq(productCategoriesTable.id, Number(req.params.id)));
  res.status(204).end();
});

/* ─── ADMIN: products ─────────────────────────────────────────────────────── */
router.get("/admin/products", adminAuth, async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  const categories = await db.select().from(productCategoriesTable).orderBy(asc(productCategoriesTable.sortOrder));
  res.json({ products, categories });
});

router.post("/admin/products", adminAuth, async (req, res): Promise<void> => {
  const { categoryId, name, description, price, images, isHidden } = req.body;
  if (!name?.trim() || !categoryId) { res.status(400).json({ error: "Name and category required" }); return; }
  const [product] = await db
    .insert(productsTable)
    .values({
      categoryId: Number(categoryId),
      name: name.trim(),
      description: description || null,
      price: price?.trim() || null,
      images: images ? JSON.stringify(images) : null,
      isHidden: isHidden === true,
    })
    .returning();
  res.json({ product });
});

router.put("/admin/products/:id", adminAuth, async (req, res): Promise<void> => {
  const { categoryId, name, description, price, images, isHidden } = req.body;
  const [product] = await db
    .update(productsTable)
    .set({
      ...(categoryId !== undefined && { categoryId: Number(categoryId) }),
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: price?.trim() || null }),
      ...(images !== undefined && { images: JSON.stringify(images) }),
      ...(isHidden !== undefined && { isHidden }),
    })
    .where(eq(productsTable.id, Number(req.params.id)))
    .returning();
  res.json({ product });
});

router.delete("/admin/products/:id", adminAuth, async (req, res): Promise<void> => {
  await db.delete(productsTable).where(eq(productsTable.id, Number(req.params.id)));
  res.status(204).end();
});

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function resolveProductImages(req: any, product: any) {
  if (!product.images) return { ...product, imageList: [] };
  let list: string[] = [];
  try { list = JSON.parse(product.images); } catch { list = []; }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "localhost";
  const resolved = list.map((img: string) => {
    if (img.startsWith("http")) return img;
    return `${proto}://${host}${img}`;
  });
  return { ...product, imageList: resolved };
}

export default router;
