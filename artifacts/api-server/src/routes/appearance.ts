import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq, like, or } from "drizzle-orm";
import { adminAuth } from "../middleware/adminAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { r2Upload } from "../lib/r2";

const router: IRouter = Router();

const ASSETS_DIR = path.join(process.cwd(), "uploads", "appearance");
fs.mkdirSync(ASSETS_DIR, { recursive: true });

const memUpload = (maxMB: number) => multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMB * 1024 * 1024 } });

/* ─── Public: جلب كل إعدادات المظهر ─────────────────────────────────────── */
router.get("/appearance", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(settingsTable).where(
    or(like(settingsTable.key, "appearance_%"), like(settingsTable.key, "support_%"))
  );
  const out: Record<string, string> = {
    appearance_site_name:          "Mismari | مسماري",
    appearance_app_name:           "مسماري",
    appearance_site_description:   "",
    appearance_logo_url:           "",
    appearance_favicon_url:        "",
    appearance_og_image_url:       "",
    appearance_font_family:        "Tajawal",
    appearance_font_file_url:      "",
    appearance_web_primary:        "#9fbcff",
    appearance_web_text:           "#ffffff",
    appearance_web_bg:             "#2b283b",
    appearance_admin_bg:           "#000000",
    appearance_admin_text:         "#ffffff",
    appearance_admin_accent:       "#9fbcff",
    appearance_app_light_primary:  "#9fbcff",
    appearance_app_light_text:     "#2b283b",
    appearance_app_light_bg:       "#ffffff",
    appearance_app_dark_primary:   "#9fbcff",
    appearance_app_dark_text:      "#ffffff",
    appearance_app_dark_bg:        "#2b283b",
    appearance_announcement_on:    "false",
    appearance_announcement_text:  "",
    appearance_announcement_color: "#9fbcff",
    appearance_seo_keywords:           "",
    appearance_ai_avatar_light_url:    "",
    appearance_ai_avatar_dark_url:     "",
  };
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

/* ─── Asset serving (legacy local files) ─────────────────────────────────── */
router.get("/appearance/assets/:type/:filename", (req: Request, res: Response): void => {
  const filePath = path.join(ASSETS_DIR, req.params.type, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).send("Not found"); return; }
  res.sendFile(filePath);
});

/* ─── Helper: سجّل URL في settings ─────────────────────────────────────── */
async function saveSettingUrl(key: string, url: string) {
  await db.insert(settingsTable)
    .values({ key, value: url })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: url, updatedAt: new Date() } });
}

/* ─── Helper: رفع ملف لـ R2 ─────────────────────────────────────────────── */
async function uploadAsset(req: Request, res: Response, r2Prefix: string, settingKey: string): Promise<void> {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  try {
    const ext = path.extname(req.file.originalname) || ".bin";
    const filename = `file${ext}`;
    const url = await r2Upload(`appearance/${r2Prefix}/${filename}`, req.file.buffer, req.file.mimetype || "application/octet-stream");
    await saveSettingUrl(settingKey, url);
    res.json({ ok: true, url });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل الرفع" });
  }
}

/* ─── رفع اللوغو ─────────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-logo", adminAuth, memUpload(5).single("file"), (req: Request, res: Response) =>
  uploadAsset(req, res, "logo", "appearance_logo_url"));

/* ─── رفع الفافيكون ──────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-favicon", adminAuth, memUpload(2).single("file"), (req: Request, res: Response) =>
  uploadAsset(req, res, "favicon", "appearance_favicon_url"));

/* ─── رفع صورة OG ────────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-og", adminAuth, memUpload(5).single("file"), (req: Request, res: Response) =>
  uploadAsset(req, res, "og", "appearance_og_image_url"));

/* ─── رفع ملف الخط ───────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-font", adminAuth, memUpload(20).single("file"), (req: Request, res: Response) =>
  uploadAsset(req, res, "font", "appearance_font_file_url"));

/* ─── رفع صورة AI (وضع نهاري) ────────────────────────────────────────────── */
router.post("/admin/appearance/upload-ai-avatar-light", adminAuth, memUpload(5).single("file"), (req: Request, res: Response) =>
  uploadAsset(req, res, "ai-avatar-light", "appearance_ai_avatar_light_url"));

/* ─── رفع صورة AI (وضع ليلي) ─────────────────────────────────────────────── */
router.post("/admin/appearance/upload-ai-avatar-dark", adminAuth, memUpload(5).single("file"), (req: Request, res: Response) =>
  uploadAsset(req, res, "ai-avatar-dark", "appearance_ai_avatar_dark_url"));

export default router;
