import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { adminAuth } from "../middleware/adminAuth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const ASSETS_DIR = path.join(process.cwd(), "uploads", "appearance");
fs.mkdirSync(ASSETS_DIR, { recursive: true });

function makeStorage(subdir: string) {
  fs.mkdirSync(path.join(ASSETS_DIR, subdir), { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(ASSETS_DIR, subdir)),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".bin";
      cb(null, `file${ext}`);
    },
  });
}

const logoUpload       = multer({ storage: makeStorage("logo"),         limits: { fileSize: 5 * 1024 * 1024 } });
const faviconUpload    = multer({ storage: makeStorage("favicon"),      limits: { fileSize: 2 * 1024 * 1024 } });
const ogUpload         = multer({ storage: makeStorage("og"),           limits: { fileSize: 5 * 1024 * 1024 } });
const fontUpload       = multer({ storage: makeStorage("font"),         limits: { fileSize: 20 * 1024 * 1024 } });
const aiAvatarLightUp  = multer({ storage: makeStorage("ai-avatar-light"), limits: { fileSize: 5 * 1024 * 1024 } });
const aiAvatarDarkUp   = multer({ storage: makeStorage("ai-avatar-dark"),  limits: { fileSize: 5 * 1024 * 1024 } });

/* ─── Public: جلب كل إعدادات المظهر ─────────────────────────────────────── */
router.get("/appearance", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(settingsTable).where(like(settingsTable.key, "appearance_%"));
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

/* ─── Asset serving ──────────────────────────────────────────────────────── */
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

/* ─── رفع اللوغو ─────────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-logo", adminAuth, logoUpload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  const url = `/api/appearance/assets/logo/${req.file.filename}`;
  await saveSettingUrl("appearance_logo_url", url);
  res.json({ ok: true, url });
});

/* ─── رفع الفافيكون ──────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-favicon", adminAuth, faviconUpload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  const url = `/api/appearance/assets/favicon/${req.file.filename}`;
  await saveSettingUrl("appearance_favicon_url", url);
  res.json({ ok: true, url });
});

/* ─── رفع صورة OG ────────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-og", adminAuth, ogUpload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  const url = `/api/appearance/assets/og/${req.file.filename}`;
  await saveSettingUrl("appearance_og_image_url", url);
  res.json({ ok: true, url });
});

/* ─── رفع ملف الخط ───────────────────────────────────────────────────────── */
router.post("/admin/appearance/upload-font", adminAuth, fontUpload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  const url = `/api/appearance/assets/font/${req.file.filename}`;
  await saveSettingUrl("appearance_font_file_url", url);
  res.json({ ok: true, url });
});

/* ─── رفع صورة AI (وضع نهاري) ────────────────────────────────────────────── */
router.post("/admin/appearance/upload-ai-avatar-light", adminAuth, aiAvatarLightUp.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  const url = `/api/appearance/assets/ai-avatar-light/${req.file.filename}`;
  await saveSettingUrl("appearance_ai_avatar_light_url", url);
  res.json({ ok: true, url });
});

/* ─── رفع صورة AI (وضع ليلي) ─────────────────────────────────────────────── */
router.post("/admin/appearance/upload-ai-avatar-dark", adminAuth, aiAvatarDarkUp.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  const url = `/api/appearance/assets/ai-avatar-dark/${req.file.filename}`;
  await saveSettingUrl("appearance_ai_avatar_dark_url", url);
  res.json({ ok: true, url });
});

export default router;
