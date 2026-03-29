import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable, appsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { adminAuth } from "../middleware/adminAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const router: IRouter = Router();

/* ─── مجلدات ────────────────────────────────────────────────────────────── */
const TEMPLATE_DIR = path.join(process.cwd(), "uploads", "telegram-template");
fs.mkdirSync(TEMPLATE_DIR, { recursive: true });

const templateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMPLATE_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `template${ext}`);
  },
});
const templateUpload = multer({ storage: templateStorage, limits: { fileSize: 10 * 1024 * 1024 } });

/* ─── مساعد: جلب إعداد من DB ───────────────────────────────────────────── */
async function getSetting(key: string): Promise<string> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return rows[0]?.value || "";
}

async function setSetting(key: string, value: string) {
  await db.insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

/* ─── مساعد: استدعاء Telegram API ──────────────────────────────────────── */
async function tgApi(token: string, method: string, body?: Record<string, unknown>) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

/* ─── تركيب صورة: أيقونة التطبيق فوق قالب ──────────────────────────────── */
async function composeImage(iconUrl: string): Promise<Buffer | null> {
  try {
    /* إيجاد آخر قالب */
    const templates = fs.readdirSync(TEMPLATE_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    if (templates.length === 0) return null;
    const templatePath = path.join(TEMPLATE_DIR, templates[0]);

    /* تحميل أيقونة التطبيق */
    const iconRes = await fetch(iconUrl);
    if (!iconRes.ok) return null;
    const iconBuf = Buffer.from(await iconRes.arrayBuffer());

    /* أبعاد القالب */
    const templateMeta = await sharp(templatePath).metadata();
    const W = templateMeta.width || 800;
    const H = templateMeta.height || 800;

    /* حجم الأيقونة = 30% من عرض القالب، مربعة */
    const iconSize = Math.round(W * 0.30);

    /* تحضير الأيقونة: تقليص + تدوير الزوايا */
    const iconProcessed = await sharp(iconBuf)
      .resize(iconSize, iconSize, { fit: "cover" })
      .png()
      .toBuffer();

    /* وضع الأيقونة: زاوية يمين أعلى مع padding */
    const pad = Math.round(W * 0.04);
    const top = pad;
    const left = W - iconSize - pad;

    const composed = await sharp(templatePath)
      .composite([{ input: iconProcessed, top, left, blend: "over" }])
      .jpeg({ quality: 90 })
      .toBuffer();

    return composed;
  } catch (e) {
    console.error("[telegram] composeImage error:", e);
    return null;
  }
}

/* ─── إرسال تطبيق لقناة التيليكرام ─────────────────────────────────────── */
export async function postAppToTelegram(appId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await getSetting("telegram_bot_token");
    const channelId = await getSetting("telegram_channel_id");
    if (!token || !channelId) return { ok: false, error: "توكن البوت أو معرف القناة غير مضبوط" };

    /* جلب بيانات التطبيق */
    const [app] = await db.select().from(appsTable).where(eq(appsTable.id, appId));
    if (!app) return { ok: false, error: "التطبيق غير موجود" };

    const name = app.name || "تطبيق";
    const version = app.version ? `v${app.version}` : "";
    const descAr = (app as any).descriptionAr || app.description || "";
    const descEn = (app as any).descriptionEn || "";
    const iconUrl = (app as any).iconUrl || (app as any).icon || "";

    /* بناء نص الرسالة */
    const lines: string[] = [];
    lines.push(`📱 *${name}* ${version}`);
    lines.push("");
    if (descAr) { lines.push(descAr); lines.push(""); }
    if (descEn) { lines.push(descEn); lines.push(""); }
    lines.push(`🔗 @${(await getSetting("store_telegram_username") || "mismari_store")}`);

    const caption = lines.join("\n");

    /* محاولة تركيب صورة مع القالب */
    let composed: Buffer | null = null;
    if (iconUrl) {
      composed = await composeImage(iconUrl);
    }

    if (composed) {
      /* إرسال صورة مركّبة */
      const form = new FormData();
      form.append("chat_id", channelId);
      form.append("caption", caption);
      form.append("parse_mode", "Markdown");
      form.append("photo", new Blob([composed], { type: "image/jpeg" }), "app.jpg");

      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      const tgData = await tgRes.json() as { ok: boolean; description?: string };
      if (!tgData.ok) return { ok: false, error: tgData.description };
    } else if (iconUrl) {
      /* إرسال أيقونة مباشرة إذا لم يوجد قالب */
      const tgData = await tgApi(token, "sendPhoto", {
        chat_id: channelId,
        photo: iconUrl,
        caption,
        parse_mode: "Markdown",
      }) as { ok: boolean; description?: string };
      if (!tgData.ok) return { ok: false, error: tgData.description };
    } else {
      /* إرسال نص فقط */
      const tgData = await tgApi(token, "sendMessage", {
        chat_id: channelId,
        text: caption,
        parse_mode: "Markdown",
      }) as { ok: boolean; description?: string };
      if (!tgData.ok) return { ok: false, error: tgData.description };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  API Routes                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/* اختبار توكن البوت */
router.post("/admin/telegram/check", adminAuth, async (req, res): Promise<void> => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ error: "token مطلوب" }); return; }
  try {
    const data = await tgApi(token, "getMe") as { ok: boolean; result?: { username?: string; first_name?: string }; description?: string };
    if (!data.ok) { res.json({ ok: false, error: data.description }); return; }
    res.json({ ok: true, bot: data.result });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

/* جلب القنوات الموجودة (updates) */
router.post("/admin/telegram/get-updates", adminAuth, async (req, res): Promise<void> => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ error: "token مطلوب" }); return; }
  try {
    const data = await tgApi(token, "getUpdates", { allowed_updates: ["my_chat_member", "message"] }) as {
      ok: boolean;
      result?: Array<{ my_chat_member?: { chat?: { id: number; title?: string; type?: string; username?: string } } }>;
    };
    if (!data.ok) { res.json({ ok: false, channels: [] }); return; }

    const channels = new Map<number, { id: number; title: string; username?: string; type: string }>();
    for (const update of data.result || []) {
      const chat = update.my_chat_member?.chat;
      if (chat && (chat.type === "channel" || chat.type === "supergroup")) {
        channels.set(chat.id, {
          id: chat.id,
          title: chat.title || String(chat.id),
          username: chat.username,
          type: chat.type,
        });
      }
    }
    res.json({ ok: true, channels: Array.from(channels.values()) });
  } catch (e) {
    res.json({ ok: false, channels: [], error: String(e) });
  }
});

/* رفع قالب الصورة */
router.post("/admin/telegram/upload-template", adminAuth, templateUpload.single("template"), (req: Request, res: Response): void => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  const urlPath = `/api/admin/telegram/template/${req.file.filename}`;
  res.json({ ok: true, url: urlPath, filename: req.file.filename });
});

/* عرض القالب */
router.get("/admin/telegram/template/:filename", (req: Request, res: Response): void => {
  const filePath = path.join(TEMPLATE_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "غير موجود" }); return; }
  res.sendFile(filePath);
});

/* الحصول على اسم القالب الحالي */
router.get("/admin/telegram/template-info", adminAuth, (_req: Request, res: Response): void => {
  const files = fs.readdirSync(TEMPLATE_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  if (files.length === 0) { res.json({ exists: false }); return; }
  res.json({ exists: true, filename: files[0], url: `/api/admin/telegram/template/${files[0]}` });
});

/* حذف القالب */
router.delete("/admin/telegram/template", adminAuth, (_req: Request, res: Response): void => {
  const files = fs.readdirSync(TEMPLATE_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  files.forEach(f => fs.unlinkSync(path.join(TEMPLATE_DIR, f)));
  res.json({ ok: true });
});

/* نشر تطبيق يدوياً */
router.post("/admin/telegram/post-app/:id", adminAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const result = await postAppToTelegram(id);
  res.json(result);
});

/* إرسال رسالة اختبار */
router.post("/admin/telegram/test", adminAuth, async (req, res): Promise<void> => {
  const { token, channelId } = req.body;
  const t = token || await getSetting("telegram_bot_token");
  const c = channelId || await getSetting("telegram_channel_id");
  if (!t || !c) { res.json({ ok: false, error: "توكن البوت أو معرف القناة مطلوب" }); return; }
  try {
    const data = await tgApi(t, "sendMessage", {
      chat_id: c,
      text: "✅ *مسماري | Mismari*\n\nتم ربط البوت بنجاح! 🎉",
      parse_mode: "Markdown",
    }) as { ok: boolean; description?: string };
    res.json(data.ok ? { ok: true } : { ok: false, error: data.description });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

export default router;
