import { Router, type IRouter } from "express";
import { eq, desc, sql, ilike, or, and, ne, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { db, appsTable, categoriesTable, plansTable, subscriptionsTable, featuredBannersTable, settingsTable, groupsTable, notificationsTable, adminsTable, reviewsTable, balanceTransactionsTable, appPlansTable, adminAuditLogsTable } from "@workspace/db";
import { auditLog } from "../lib/auditLog";
import { sendSecurityAlert } from "../lib/securityAlert";
import {
  AdminListAppsQueryParams,
  AdminListAppsResponse,
  AdminCreateAppBody,
  AdminUpdateAppParams,
  AdminUpdateAppBody,
  AdminDeleteAppParams,
  AdminListCategoriesResponse,
  AdminCreateCategoryBody,
  AdminListPlansResponse,
  AdminCreatePlanBody,
  AdminGetStatsResponse,
  AdminLoginBody,
  AdminLoginResponse,
} from "@workspace/api-zod";
import { adminAuth, JWT_SECRET } from "../middleware/adminAuth";
import { notifyAppAdded, notifyAppUpdated, sendBroadcast, sendBroadcastToGroup } from "../lib/pushNotifications";
import { postAppToTelegram } from "./telegram";
import { r2Upload, r2Delete, r2Url, urlToKey } from "../lib/r2";
import { flushDylibCache, disableDylib, enableDylib, STORE_DYLIB_PATH } from "../lib/dylibs";
import AdmZip from "adm-zip";
import plist from "plist";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Rate Limiter: max 5 login attempts per IP per 15 min ───────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "محاولات دخول كثيرة جداً — انتظر 15 دقيقة" },
});

// ─── Rate Limiter: reviews ────────────────────────────────────────────────────
const reviewsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً — حاول بعد قليل" },
});

// ─── Rate Limiter: translate (free API — prevent abuse) ───────────────────────
const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات ترجمة كثيرة جداً" },
});

// ─── Global Auth Guard ────────────────────────────────────────────────────────
// All /admin/* routes require authentication EXCEPT the explicit public list below.
// Routes not starting with /admin (e.g. /reviews) are handled per-route.
const ADMIN_PUBLIC_EXACT: { method: string; path: string }[] = [
  { method: "GET",  path: "/admin/captcha" },
  { method: "POST", path: "/admin/login" },
];
const ADMIN_PUBLIC_PREFIX: string[] = [
  "/admin/banner-image/",   // public banner images shown on store
  "/admin/signed-store/",   // iOS IPA downloads — security-by-obscurity filenames
];

router.use((req, res, next) => {
  // Non-admin paths (e.g. /reviews) — skip global guard, handled per-route
  if (!req.path.startsWith("/admin")) return next();

  // Exact public routes (captcha, login, stats)
  if (ADMIN_PUBLIC_EXACT.some(r => r.method === req.method && req.path === r.path)) {
    return next();
  }

  // Public path prefixes (banner images, signed IPAs)
  if (ADMIN_PUBLIC_PREFIX.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  // Everything else under /admin/* requires a valid JWT
  return adminAuth(req, res, next);
});

// ─── CAPTCHA Generator ───────────────────────────────────────────────────────
const CAPTCHA_SECRET = JWT_SECRET + "_captcha";
const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCaptchaSvg(text: string): string {
  const W = 200, H = 70;
  const bgColors = ["#0a0a0a", "#111111"];
  const lines: string[] = [];

  // Noise dots
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 2 + 0.5;
    lines.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#9fbcff" opacity="${(Math.random() * 0.4 + 0.1).toFixed(2)}"/>`);
  }

  // Noise lines
  for (let i = 0; i < 6; i++) {
    const x1 = Math.random() * W, y1 = Math.random() * H;
    const x2 = Math.random() * W, y2 = Math.random() * H;
    lines.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#9fbcff" stroke-width="${(Math.random() * 1.5 + 0.5).toFixed(1)}" opacity="0.3"/>`);
  }

  // Characters with rotation and offset
  const charW = W / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const x = charW * (i + 0.8) + (Math.random() * 6 - 3);
    const y = H / 2 + (Math.random() * 10 - 5);
    const rot = Math.random() * 30 - 15;
    const size = Math.floor(Math.random() * 8 + 22);
    const colors = ["#9fbcff", "#ffffff", "#c4d9ff", "#7da5ff"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    lines.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="bold" font-family="monospace" fill="${color}" transform="rotate(${rot.toFixed(1)},${x.toFixed(1)},${y.toFixed(1)})" opacity="0.95">${text[i]}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${bgColors[0]}" rx="8"/>
<rect width="${W}" height="${H}" fill="url(#g)" rx="8"/>
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#0d0d0d"/><stop offset="100%" stop-color="#1a1a2e"/>
</linearGradient></defs>
${lines.join("\n")}
</svg>`;
}

// ─── GET /api/admin/captcha ──────────────────────────────────────────────────
router.get("/admin/captcha", (_req, res): void => {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  const svg = generateCaptchaSvg(code);
  const imageData = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const token = jwt.sign({ code }, CAPTCHA_SECRET, { expiresIn: "5m" });
  res.json({ imageData, token });
});

// ─── POST /api/admin/login ───────────────────────────────────────────────────
router.post("/admin/login", loginLimiter, async (req, res): Promise<void> => {
  const { username, password, captchaToken, captchaAnswer } = req.body as {
    username?: string;
    password?: string;
    captchaToken?: string;
    captchaAnswer?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    return;
  }

  // ── Validate CAPTCHA ──────────────────────────────────────────────────────
  if (!captchaToken || !captchaAnswer) {
    res.status(400).json({ error: "يرجى إدخال رمز التحقق" });
    return;
  }
  try {
    const payload = jwt.verify(captchaToken, CAPTCHA_SECRET) as { code: string };
    if (payload.code.toUpperCase() !== captchaAnswer.toUpperCase().trim()) {
      res.status(401).json({ error: "رمز التحقق غير صحيح" });
      return;
    }
  } catch {
    res.status(401).json({ error: "رمز التحقق منتهي الصلاحية — حدّث الصفحة" });
    return;
  }

  // ── Find admin in DB ──────────────────────────────────────────────────────
  try {
    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, username.trim()))
      .limit(1);

    if (!admin || !admin.isActive) {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }

    const hash = hashPassword(password, admin.salt);
    if (hash !== admin.passwordHash) {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }

    // Update last login
    await db.update(adminsTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(adminsTable.id, admin.id));

    const permissions: string[] = JSON.parse(admin.permissions || "[]");
    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: admin.role, permissions },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    auditLog(req, "LOGIN", "admins", admin.id, { username: admin.username, role: admin.role }).catch(() => {});
    res.json({ success: true, token, username: admin.username, role: admin.role, permissions });
  } catch (err) {
    console.error("[admin/login] error:", err);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

// ─── GET /api/reviews?appId=X (public — fetch reviews for app) ──────────────
// Note: phone is intentionally excluded from public response (PII protection)
router.get("/reviews", async (req, res): Promise<void> => {
  const appId = req.query.appId ? Number(req.query.appId) : undefined;
  if (!appId) { res.status(400).json({ error: "appId required" }); return; }
  const rows = await db
    .select({
      id: reviewsTable.id,
      subscriberName: reviewsTable.subscriberName,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.appId, appId), eq(reviewsTable.isHidden, false)))
    .orderBy(desc(reviewsTable.createdAt));
  res.json({ reviews: rows });
});

// ─── POST /api/reviews (public — submit review from app) ────────────────────
router.post("/reviews", reviewsLimiter, async (req, res): Promise<void> => {
  const { appId, code, rating, text } = req.body;
  if (!appId || !rating || !text?.trim()) { res.status(400).json({ error: "بيانات ناقصة" }); return; }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    res.status(400).json({ error: "التقييم يجب أن يكون بين 1 و 5" }); return;
  }
  if (text.trim().length > 1000) {
    res.status(400).json({ error: "النص يجب أن يكون أقل من 1000 حرف" }); return;
  }
  let subscriptionId: number | null = null;
  let subscriberName: string | null = null;
  let phone: string | null = null;
  if (code) {
    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.code, code));
    if (sub) { subscriptionId = sub.id; subscriberName = sub.subscriberName; phone = sub.phone; }
  }
  const [review] = await db.insert(reviewsTable).values({
    appId: Number(appId), subscriptionId, subscriberName, phone,
    rating: Number(rating), text: text.trim(),
  }).returning();
  res.status(201).json({ review });
});

// ─── PUBLIC: Serve signed store IPAs — no auth required ─────────────────────
// Legacy records in DB still have /api/admin/signed-store/... URLs.
// iOS itms-services:// cannot send auth headers, so serve the file directly.
// Note: SIGNED_STORE_DIR is defined lower in this file; use a lazy reference.
router.get("/admin/signed-store/:filename", (req, res): void => {
  const filename = req.params.filename;
  if (filename.includes("..") || filename.includes("/")) { res.status(400).send("Invalid"); return; }
  const dir = path.join(process.cwd(), "uploads", "SignedStore");
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "ملف غير موجود" }); return; }
  const stat = fs.statSync(filePath);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(filePath).pipe(res);
});

// ─── PROTECT all routes below this line ─────────────────────────────────────
// Use "/admin" path prefix so public routes (e.g. /profile/enroll) are NOT intercepted
router.use("/admin", adminAuth);

// ─── STATS ─────────────────────────────────────────────────────────────────

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [{ totalApps }] = await db.select({ totalApps: sql<number>`count(*)::int` }).from(appsTable);
  const [{ totalCategories }] = await db.select({ totalCategories: sql<number>`count(*)::int` }).from(categoriesTable);
  const [{ totalSubscriptions }] = await db.select({ totalSubscriptions: sql<number>`count(*)::int` }).from(subscriptionsTable);
  const [{ activeSubscriptions }] = await db
    .select({ activeSubscriptions: sql<number>`count(*)::int` })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.isActive, "true"));

  res.json(
    AdminGetStatsResponse.parse({ totalApps, totalCategories, totalSubscriptions, activeSubscriptions })
  );
});

// ─── APPS ──────────────────────────────────────────────────────────────────

router.get("/admin/apps", async (req, res): Promise<void> => {
  const query = AdminListAppsQueryParams.safeParse(req.query);
  const page = query.success ? query.data.page ?? 1 : 1;
  const limit = query.success ? query.data.limit ?? 50 : 50;
  const offset = (page - 1) * limit;
  const search   = (req.query as any).search   as string | undefined;
  const sortBy   = (req.query as any).sortBy   as string | undefined; // "downloads" | "createdAt"
  const categoryId = (req.query as any).categoryId ? Number((req.query as any).categoryId) : undefined;

  const searchCond = search
    ? or(ilike(appsTable.name, `%${search}%`), ilike(appsTable.bundleId, `%${search}%`))
    : undefined;
  const catCond = categoryId ? eq(appsTable.categoryId, categoryId) : undefined;

  const whereClause = searchCond && catCond
    ? and(searchCond, catCond)
    : searchCond ?? catCond;

  const orderClause = sortBy === "downloads"
    ? desc(appsTable.downloads)
    : desc(appsTable.createdAt);

  const apps = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      descriptionAr: appsTable.descriptionAr,
      descriptionEn: appsTable.descriptionEn,
      icon: appsTable.icon,
      ipaPath: appsTable.ipaPath,
      iconPath: appsTable.iconPath,
      categoryId: appsTable.categoryId,
      categoryName: categoriesTable.name,
      tag: appsTable.tag,
      version: appsTable.version,
      bundleId: appsTable.bundleId,
      size: appsTable.size,
      downloadUrl: appsTable.downloadUrl,
      downloads: appsTable.downloads,
      isFeatured: appsTable.isFeatured,
      isHot: appsTable.isHot,
      isHidden: appsTable.isHidden,
      isTestMode: appsTable.isTestMode,
      status: appsTable.status,
      createdAt: appsTable.createdAt,
    })
    .from(appsTable)
    .leftJoin(categoriesTable, eq(appsTable.categoryId, categoriesTable.id))
    .where(whereClause)
    .orderBy(orderClause)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appsTable)
    .where(whereClause);

  // Fetch planIds for all returned apps
  const appIds = apps.map(a => a.id);
  const planRows = appIds.length > 0
    ? await db.select({ appId: appPlansTable.appId, planId: appPlansTable.planId })
        .from(appPlansTable)
        .where(inArray(appPlansTable.appId, appIds))
    : [];
  const plansByApp: Record<number, number[]> = {};
  for (const row of planRows) {
    if (!plansByApp[row.appId]) plansByApp[row.appId] = [];
    plansByApp[row.appId].push(row.planId);
  }

  res.json(
    AdminListAppsResponse.parse({
      apps: apps.map((a) => ({
        ...a,
        categoryName: a.categoryName ?? "Unknown",
        isHidden: a.isHidden ?? false,
        isTestMode: a.isTestMode ?? false,
        status: a.status ?? "active",
        planIds: plansByApp[a.id] || [],
      })),
      total: count,
      page,
      limit,
    })
  );
});

router.post("/admin/apps", async (req, res): Promise<void> => {
  const { planIds, ...bodyRest } = req.body as any;
  const parsed = AdminCreateAppBody.safeParse(bodyRest);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [app] = await db.insert(appsTable).values(parsed.data).returning();

  // Save plan assignments
  if (Array.isArray(planIds) && planIds.length > 0) {
    await db.insert(appPlansTable).values(planIds.map((pid: number) => ({ appId: app.id, planId: pid }))).onConflictDoNothing();
  }

  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, app.categoryId));

  auditLog(req, "CREATE_APP", "apps", app.id, { name: app.name, bundleId: app.bundleId }).catch(() => {});
  res.status(201).json({ ...app, categoryName: category?.name ?? "Unknown", planIds: planIds || [] });

  // Fire-and-forget: send push notifications after responding
  notifyAppAdded(app.id).catch(() => {});
  // Auto-post to Telegram if enabled
  (async () => {
    try {
      const [autoRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "telegram_auto_post"));
      if (autoRow?.value === "true") postAppToTelegram(app.id).catch(() => {});
    } catch { /* ignore */ }
  })();
});

router.put("/admin/apps/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateAppParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { planIds, ...bodyRest } = req.body as any;
  const parsed = AdminUpdateAppBody.safeParse(bodyRest);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [app] = await db
    .update(appsTable)
    .set(parsed.data)
    .where(eq(appsTable.id, params.data.id))
    .returning();

  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }

  // Replace plan assignments
  if (Array.isArray(planIds)) {
    await db.delete(appPlansTable).where(eq(appPlansTable.appId, app.id));
    if (planIds.length > 0) {
      await db.insert(appPlansTable).values(planIds.map((pid: number) => ({ appId: app.id, planId: pid }))).onConflictDoNothing();
    }
  }

  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, app.categoryId));

  res.json({ ...app, categoryName: category?.name ?? "Unknown", planIds: planIds || [] });

  // Fire-and-forget: send push notifications after responding
  notifyAppUpdated(app.id).catch(() => {});
  // Auto-post to Telegram if enabled
  (async () => {
    try {
      const [autoRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "telegram_auto_post"));
      if (autoRow?.value === "true") postAppToTelegram(app.id).catch(() => {});
    } catch { /* ignore */ }
  })();
});

router.patch("/admin/apps/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  // Allowlist only safe toggleable fields — never pass req.body directly to DB
  const ALLOWED: Array<keyof typeof appsTable.$inferInsert> = [
    "isFeatured", "isHot", "isHidden", "isTestMode", "status", "downloads",
    "tag", "version", "size", "description", "descriptionAr", "descriptionEn",
    "name", "icon", "iconPath", "categoryId", "bundleId",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in req.body) patch[key] = (req.body as any)[key];
  }
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
  const [app] = await db.update(appsTable).set(patch as any).where(eq(appsTable.id, id)).returning();
  if (!app) { res.status(404).json({ error: "App not found" }); return; }
  res.json(app);
});

router.delete("/admin/apps/:id", async (req, res): Promise<void> => {
  const params = AdminDeleteAppParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [app] = await db
    .delete(appsTable)
    .where(eq(appsTable.id, params.data.id))
    .returning();

  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  const tryDelete = (relPath: string | null | undefined) => {
    if (!relPath) return;
    try {
      const full = path.join(uploadsDir, relPath.replace(/^\/admin\/FilesIPA\//, "FilesIPA/").replace(/^\//, ""));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {}
    const key = urlToKey(relPath) || relPath.replace(/^\//, "");
    if (key) r2Delete(key).catch(() => {});
  };
  tryDelete(app.ipaPath);
  tryDelete(app.iconPath);

  auditLog(req, "DELETE_APP", "apps", params.data.id, { id: params.data.id }).catch(() => {});
  res.sendStatus(204);
});

// ─── APPS BULK ACTIONS ─────────────────────────────────────────────────────

router.post("/admin/apps/bulk-test-mode", async (req, res): Promise<void> => {
  const { appIds, enable } = req.body as { appIds: number[]; enable: boolean };
  if (!Array.isArray(appIds) || appIds.length === 0) {
    res.status(400).json({ error: "appIds required" });
    return;
  }
  await db.update(appsTable).set({ isTestMode: enable }).where(inArray(appsTable.id, appIds));
  res.json({ updated: appIds.length });
});

router.post("/admin/apps/bulk-plans", async (req, res): Promise<void> => {
  const { appIds, planIds, action } = req.body as {
    appIds: number[];
    planIds: number[];
    action: "add" | "remove" | "replace";
  };
  if (!Array.isArray(appIds) || appIds.length === 0) {
    res.status(400).json({ error: "appIds required" });
    return;
  }
  if (!Array.isArray(planIds)) {
    res.status(400).json({ error: "planIds required" });
    return;
  }
  if (action === "remove") {
    await db.delete(appPlansTable).where(
      and(inArray(appPlansTable.appId, appIds), inArray(appPlansTable.planId, planIds))
    );
  } else if (action === "replace") {
    await db.delete(appPlansTable).where(inArray(appPlansTable.appId, appIds));
    if (planIds.length > 0) {
      const rows = appIds.flatMap(appId => planIds.map(planId => ({ appId, planId })));
      await db.insert(appPlansTable).values(rows).onConflictDoNothing();
    }
  } else {
    if (planIds.length > 0) {
      const rows = appIds.flatMap(appId => planIds.map(planId => ({ appId, planId })));
      await db.insert(appPlansTable).values(rows).onConflictDoNothing();
    }
  }
  res.json({ updated: appIds.length });
});

router.post("/admin/apps/bulk-category", async (req, res): Promise<void> => {
  const { appIds, categoryId } = req.body as { appIds: number[]; categoryId: number };
  if (!Array.isArray(appIds) || appIds.length === 0) {
    res.status(400).json({ error: "appIds required" });
    return;
  }
  if (!categoryId || typeof categoryId !== "number") {
    res.status(400).json({ error: "categoryId required" });
    return;
  }
  const [category] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, categoryId)).limit(1);
  if (!category) {
    res.status(404).json({ error: "القسم غير موجود" });
    return;
  }
  await db.update(appsTable).set({ categoryId }).where(inArray(appsTable.id, appIds));
  res.json({ updated: appIds.length });
});

// ─── CATEGORIES ────────────────────────────────────────────────────────────

router.get("/admin/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name, nameAr: categoriesTable.nameAr, icon: categoriesTable.icon })
    .from(categoriesTable);

  const counts = await db
    .select({ categoryId: appsTable.categoryId, cnt: sql<number>`count(*)::int` })
    .from(appsTable)
    .groupBy(appsTable.categoryId);

  const countMap: Record<number, number> = {};
  for (const row of counts) if (row.categoryId != null) countMap[row.categoryId] = Number(row.cnt);

  const result = categories.map(c => ({ ...c, appCount: countMap[c.id] ?? 0 }));
  res.json(AdminListCategoriesResponse.parse({ categories: result }));
});

router.post("/admin/categories", async (req, res): Promise<void> => {
  const parsed = AdminCreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json(category);
});

router.put("/admin/categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, nameAr, icon } = req.body;
  const [cat] = await db.update(categoriesTable).set({ name, nameAr, icon }).where(eq(categoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cat);
});

router.delete("/admin/categories/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.sendStatus(204);
});

// ─── PLANS ─────────────────────────────────────────────────────────────────

router.get("/admin/plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable);
  res.json(
    AdminListPlansResponse.parse({
      plans: plans.map((p) => ({ ...p, price: Number(p.price), excludedFeatures: p.excludedFeatures ?? [] })),
    })
  );
});

router.post("/admin/plans", async (req, res): Promise<void> => {
  const parsed = AdminCreatePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db.insert(plansTable).values({
    ...parsed.data,
    price: String(parsed.data.price),
  }).returning();

  res.status(201).json({ ...plan, price: Number(plan.price) });
});

router.put("/admin/plans/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, nameAr, price, currency, duration, features, excludedFeatures, isPopular } = req.body;
  const [plan] = await db.update(plansTable).set({
    name, nameAr,
    price: price !== undefined ? String(price) : undefined,
    currency, duration, features, excludedFeatures, isPopular,
  }).where(eq(plansTable.id, id)).returning();
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...plan, price: Number(plan.price) });
});

router.delete("/admin/plans/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(plansTable).where(eq(plansTable.id, id));
  res.sendStatus(204);
});

// ─── SUBSCRIPTIONS ─────────────────────────────────────────────────────────

router.get("/admin/subscriptions", async (req, res): Promise<void> => {
  const page = Number((req.query as any).page || 1);
  const limit = Number((req.query as any).limit || 50);
  const search = (req.query as any).search as string | undefined;
  const isActiveFilter = (req.query as any).isActive as string | undefined;
  const activated = (req.query as any).activated as string | undefined;
  const offset = (page - 1) * limit;

  const conds: any[] = [];
  if (search) {
    conds.push(or(
      ilike(subscriptionsTable.subscriberName, `%${search}%`),
      ilike(subscriptionsTable.phone, `%${search}%`),
      ilike(subscriptionsTable.email, `%${search}%`),
      ilike(subscriptionsTable.code, `%${search}%`),
      ilike(subscriptionsTable.udid, `%${search}%`),
    ));
  }
  if (isActiveFilter === "true" || isActiveFilter === "false") {
    conds.push(eq(subscriptionsTable.isActive, isActiveFilter));
  }
  if (activated === "yes") {
    conds.push(sql`${subscriptionsTable.subscriberName} IS NOT NULL`);
  } else if (activated === "no") {
    conds.push(sql`${subscriptionsTable.subscriberName} IS NULL`);
  }

  const whereClause = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      id: subscriptionsTable.id,
      code: subscriptionsTable.code,
      udid: subscriptionsTable.udid,
      phone: subscriptionsTable.phone,
      email: subscriptionsTable.email,
      deviceType: subscriptionsTable.deviceType,
      subscriberName: subscriptionsTable.subscriberName,
      groupName: subscriptionsTable.groupName,
      planId: subscriptionsTable.planId,
      planName: plansTable.name,
      planNameAr: plansTable.nameAr,
      sourceType: subscriptionsTable.sourceType,
      isActive: subscriptionsTable.isActive,
      balance: subscriptionsTable.balance,
      pushToken: subscriptionsTable.pushToken,
      activatedAt: subscriptionsTable.activatedAt,
      expiresAt: subscriptionsTable.expiresAt,
      aiEnabled: subscriptionsTable.aiEnabled,
      aiExpiresAt: subscriptionsTable.aiExpiresAt,
      createdAt: subscriptionsTable.createdAt,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(whereClause)
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(subscriptionsTable)
    .where(whereClause);

  res.json({ subscriptions: rows, total, page, limit });
});

router.post("/admin/subscriptions", async (req, res): Promise<void> => {
  const { code, udid, phone, email, deviceType, subscriberName, groupName, planId, isActive, activatedAt, expiresAt } = req.body;
  if (!code || !planId) { res.status(400).json({ error: "code and planId are required" }); return; }

  const [sub] = await db.insert(subscriptionsTable).values({
    code,
    udid: udid || null,
    phone: phone || null,
    email: email || null,
    deviceType: deviceType || null,
    subscriberName: subscriberName || null,
    groupName: groupName || null,
    planId: Number(planId),
    isActive: isActive || "true",
    activatedAt: activatedAt ? new Date(activatedAt) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();

  auditLog(req, "CREATE_SUBSCRIPTION", "subscriptions", sub.id, { code, subscriberName, planId }).catch(() => {});
  res.status(201).json(sub);
});

router.put("/admin/subscriptions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { code, udid, phone, email, deviceType, subscriberName, groupName, planId, isActive, expiresAt } = req.body;
  const [sub] = await db.update(subscriptionsTable).set({
    ...(code !== undefined && { code }),
    ...(udid !== undefined && { udid }),
    ...(phone !== undefined && { phone }),
    ...(email !== undefined && { email }),
    ...(deviceType !== undefined && { deviceType }),
    ...(subscriberName !== undefined && { subscriberName }),
    ...(groupName !== undefined && { groupName }),
    ...(planId !== undefined && { planId: Number(planId) }),
    ...(isActive !== undefined && { isActive }),
    ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
  }).where(eq(subscriptionsTable.id, id)).returning();
  if (!sub) { res.status(404).json({ error: "Not found" }); return; }
  res.json(sub);
});

router.delete("/admin/subscriptions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.id, id));
  auditLog(req, "DELETE_SUBSCRIPTION", "subscriptions", id).catch(() => {});
  res.sendStatus(204);
});

// Delete multiple subscriptions
router.post("/admin/subscriptions/bulk-delete", async (req, res): Promise<void> => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids required" }); return; }
  const numIds = ids.map(Number).filter(n => n > 0);
  if (numIds.length === 0) { res.status(400).json({ error: "invalid ids" }); return; }
  await db.delete(subscriptionsTable).where(inArray(subscriptionsTable.id, numIds));
  auditLog(req, "BULK_DELETE_SUBSCRIPTIONS", "subscriptions", null, { ids: numIds, count: numIds.length }).catch(() => {});
  res.json({ deleted: numIds.length });
});

// ─── BANNER IMAGE UPLOAD ───────────────────────────────────────────────────
const bannerUploadDir = path.join(process.cwd(), "uploads", "banners");
if (!fs.existsSync(bannerUploadDir)) fs.mkdirSync(bannerUploadDir, { recursive: true });

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);
const ALLOWED_IMAGE_EXTS  = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype) || !ALLOWED_IMAGE_EXTS.has(ext)) {
      return cb(new Error("يُقبل فقط صور JPG/PNG/GIF/WebP/AVIF"));
    }
    cb(null, true);
  },
});

router.post("/admin/upload-banner", bannerUpload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  try {
    const ext = path.extname(req.file.originalname) || ".jpg";
    const filename = `banner_${crypto.randomBytes(8).toString("hex")}${ext}`;
    const url = await r2Upload(`banners/${filename}`, req.file.buffer, req.file.mimetype || "image/jpeg");
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل الرفع" });
  }
});

router.get("/admin/banner-image/:filename", (req, res): void => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(bannerUploadDir, filename);
  if (!fs.existsSync(filePath)) { res.status(404).send("Not found"); return; }
  res.sendFile(filePath);
});

// ─── FEATURED BANNERS ──────────────────────────────────────────────────────

router.get("/admin/featured", async (_req, res): Promise<void> => {
  const banners = await db.select().from(featuredBannersTable).orderBy(featuredBannersTable.sortOrder);
  res.json({ banners });
});

router.post("/admin/featured", async (req, res): Promise<void> => {
  const { title, titleEn, description, descriptionEn, image, imageEn, link, isActive } = req.body;
  const [count] = await db.select({ c: sql<number>`count(*)::int` }).from(featuredBannersTable);
  const [banner] = await db.insert(featuredBannersTable).values({
    title: title || "",
    titleEn: titleEn || null,
    description: description || null,
    descriptionEn: descriptionEn || null,
    image: image || null,
    imageEn: imageEn || null,
    link: link || null,
    sortOrder: (count?.c || 0) + 1,
    isActive: isActive !== false,
  }).returning();
  res.status(201).json(banner);
});

router.put("/admin/featured/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, titleEn, description, descriptionEn, image, imageEn, link, isActive, sortOrder } = req.body;
  const [banner] = await db.update(featuredBannersTable).set({
    ...(title !== undefined && { title }),
    ...(titleEn !== undefined && { titleEn }),
    ...(description !== undefined && { description }),
    ...(descriptionEn !== undefined && { descriptionEn }),
    ...(image !== undefined && { image }),
    ...(imageEn !== undefined && { imageEn }),
    ...(link !== undefined && { link }),
    ...(isActive !== undefined && { isActive }),
    ...(sortOrder !== undefined && { sortOrder }),
  }).where(eq(featuredBannersTable.id, id)).returning();
  if (!banner) { res.status(404).json({ error: "Not found" }); return; }
  res.json(banner);
});

router.delete("/admin/featured/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(featuredBannersTable).where(eq(featuredBannersTable.id, id));
  res.sendStatus(204);
});

// ─── GROUPS ────────────────────────────────────────────────────────────────
// Safety buffer: stop 2 slots before the hard limit to keep emergency seats
const IPHONE_IOS_LIMIT = 98;   // Apple hard limit: 100  (we stop at 98)
const IPHONE_MAC_LIMIT = 98;   // MAC bypass hard limit: 100 (we stop at 98)
const IPAD_LIMIT_NUM   = 98;   // iPad hard limit: 100 (we stop at 98)

// Helper: rebuild cached counts from subscriptions (used by sync endpoint)
async function rebuildGroupStats(certName: string) {
  const all = await db
    .select({ platform: subscriptionsTable.applePlatform, appleStatus: subscriptionsTable.appleStatus })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.groupName, certName));
  return {
    iphoneOfficialCount: all.filter(d => d.platform === "IOS").length,
    iphoneMacCount: all.filter(d => d.platform === "MAC").length,
    ipadCount: all.filter(d => d.platform === "IPAD_OS").length,
    pendingCount: all.filter(d => d.appleStatus === "PROCESSING").length,
    activeCount: all.filter(d => d.appleStatus === "ENABLED").length,
    totalDevices: all.length,
  };
}

// GET /admin/groups — reads stats per group from subscriptions
router.get("/admin/groups", async (_req, res): Promise<void> => {
  const groups = await db.select().from(groupsTable).orderBy(desc(groupsTable.createdAt));
  const result = await Promise.all(groups.map(async (g) => {
    const live = await rebuildGroupStats(g.certName);
    return {
      ...g,
      privateKey: g.privateKey ? "••••••••" : "",
      ...live,
    };
  }));
  res.json({ groups: result });
});

// PUT /admin/groups/:id/ipa-url — save direct IPA URL and auto-generate download slug
router.put("/admin/groups/:id/ipa-url", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { ipaUrl } = req.body as { ipaUrl?: string };

  const [existing] = await db.select({ downloadSlug: groupsTable.downloadSlug }).from(groupsTable).where(eq(groupsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  let slug = existing.downloadSlug;
  if (!slug) {
    // Generate a unique short slug (8 hex chars)
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = crypto.randomBytes(4).toString("hex");
      const [taken] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.downloadSlug, candidate));
      if (!taken) { slug = candidate; break; }
    }
  }

  const [updated] = await db
    .update(groupsTable)
    .set({ ipaUrl: ipaUrl || null, downloadSlug: slug })
    .where(eq(groupsTable.id, id))
    .returning({ ipaUrl: groupsTable.ipaUrl, downloadSlug: groupsTable.downloadSlug });

  res.json(updated);
});

// GET /admin/groups/:id/devices — full device list for a certificate
router.get("/admin/groups/:id/devices", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  const devices = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.groupName, group.certName))
    .orderBy(desc(subscriptionsTable.createdAt));
  res.json({ devices, certName: group.certName });
});

// POST /admin/groups/:id/resolve-platform
// THE PRE-FLIGHT CHECK — decides which Apple platform to use before registering
// Returns the platform + the exact Apple API payload to send
router.post("/admin/groups/:id/resolve-platform", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { deviceType, udid, deviceName } = req.body; // deviceType: "iPhone" | "iPad"

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Not found" }); return; }

  // ── UDID duplicate check (Safety Lock) ──────────────────────────────────
  if (udid) {
    const existing = await db
      .select({ id: subscriptionsTable.id, applePlatform: subscriptionsTable.applePlatform })
      .from(subscriptionsTable)
      .where(sql`${subscriptionsTable.groupName} = ${group.certName} AND ${subscriptionsTable.udid} = ${udid}`);

    if (existing.length > 0) {
      const existingPlatform = existing[0].applePlatform || "IOS";
      res.json({
        isDuplicate: true,
        platform: existingPlatform,
        canRegister: false,
        message: `⚠️ هذا الـ UDID مسجل مسبقاً في هذه الشهادة كـ ${existingPlatform}. لن يُستهلك مقعد جديد — يُحدَّث الـ Provisioning Profile فقط.`,
        applePayload: null,
        stats: await rebuildGroupStats(group.certName),
      });
      return;
    }
  }

  // ── Read local DB stats (no Apple API call here) ─────────────────────────
  const stats = await rebuildGroupStats(group.certName);
  const { iphoneOfficialCount: ios, iphoneMacCount: mac, ipadCount: ipad } = stats;

  let platform = "";
  let canRegister = true;
  let message = "";
  let applePayload: object | null = null;

  if (deviceType === "iPad") {
    if (ipad < IPAD_LIMIT_NUM) {
      platform = "IPAD_OS";
      message = `✅ مقعد آيباد متاح (${ipad + 1}/${IPAD_LIMIT_NUM}) — تسجيل كـ IOS platform لدى أبل`;
      applePayload = {
        data: {
          type: "devices",
          attributes: {
            name: deviceName || `Mismari_iPad_${ipad + 1}`,
            udid: udid || "UDID_HERE",
            platform: "IOS",  // Apple uses IOS for both iPhone & iPad in DevConnect
          },
        },
      };
    } else {
      canRegister = false;
      message = `🚫 الشهادة ممتلئة للآيبادات (${IPAD_LIMIT_NUM}/${IPAD_LIMIT_NUM}). الرجاء الانتقال لشهادة جديدة.`;
    }
  } else {
    // iPhone — Smart routing: IOS first, then MAC bypass
    if (ios < IPHONE_IOS_LIMIT) {
      platform = "IOS";
      message = `✅ مقعد IOS متاح (${ios + 1}/${IPHONE_IOS_LIMIT}) — تسجيل رسمي عادي`;
      applePayload = {
        data: {
          type: "devices",
          attributes: {
            name: deviceName || `Mismari_iPhone_${ios + 1}`,
            udid: udid || "UDID_HERE",
            platform: "IOS",  // Standard iPhone registration
          },
        },
      };
    } else if (mac < IPHONE_MAC_LIMIT) {
      platform = "MAC";
      message = `⚡ IOS امتلأت (${IPHONE_IOS_LIMIT}/${IPHONE_IOS_LIMIT}). تحويل تلقائي لـ MAC bypass (${mac + 1}/${IPHONE_MAC_LIMIT})`;
      applePayload = {
        data: {
          type: "devices",
          attributes: {
            name: deviceName || `Mismari_iPhone_MAC_${mac + 1}`,
            udid: udid || "UDID_HERE",
            platform: "MAC",  // ← الثغرة: القيمة الصحيحة عند أبل هي MAC وليس MAC_OS
          },
        },
      };
    } else {
      canRegister = false;
      message = `🚫 الشهادة ممتلئة للآيفونات (${IPHONE_IOS_LIMIT + IPHONE_MAC_LIMIT}/${IPHONE_IOS_LIMIT + IPHONE_MAC_LIMIT}). الرجاء الانتقال لشهادة جديدة.`;
    }
  }

  res.json({
    isDuplicate: false,
    platform,
    canRegister,
    message,
    applePayload,   // The exact JSON body to POST to Apple DevConnect API
    appleEndpoint: "POST https://api.appstoreconnect.apple.com/v1/devices",
    stats,
    safetyNote: `حد الأمان: ${IPHONE_IOS_LIMIT} بدل 100 (مقعدان للطوارئ)`,
  });
});

// POST /admin/groups/:id/sync — Manual sync: recount from subscriptions, update cached stats
// Trigger: Admin clicks "تحديث" button. NOT called automatically on page load.
router.post("/admin/groups/:id/sync", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Not found" }); return; }

  const stats = await rebuildGroupStats(group.certName);

  // Update cached counters in groupsTable
  const [updated] = await db.update(groupsTable).set({
    iphoneOfficialCount: stats.iphoneOfficialCount,
    iphoneMacCount: stats.iphoneMacCount,
    ipadCount: stats.ipadCount,
    lastSyncAt: new Date(),
    lastSyncNote: `تمت المزامنة من قاعدة البيانات المحلية — ${stats.totalDevices} جهاز`,
  }).where(eq(groupsTable.id, id)).returning();

  res.json({
    success: true,
    message: `تمت المزامنة بنجاح`,
    stats,
    syncedAt: updated.lastSyncAt,
  });
});

// PATCH /admin/groups/device/:subId/status
// Updates Apple status, platform, and the Apple Device ID returned after registration
// appleDeviceId is critical: Apple requires it for DELETE /v1/devices/{id}
router.patch("/admin/groups/device/:subId/status", async (req, res): Promise<void> => {
  const subId = Number(req.params.subId);
  const { appleStatus, applePlatform, appleDeviceId } = req.body;
  const updateData: Record<string, string> = {};
  if (appleStatus)   updateData.appleStatus   = appleStatus;
  if (applePlatform) updateData.applePlatform = applePlatform;
  if (appleDeviceId) updateData.appleDeviceId = appleDeviceId; // Store Apple's returned ID
  const [updated] = await db
    .update(subscriptionsTable)
    .set(updateData)
    .where(eq(subscriptionsTable.id, subId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.post("/admin/groups", async (req, res): Promise<void> => {
  const { certName, issuerId, keyId, privateKey, email } = req.body;
  if (!certName || !issuerId || !keyId || !privateKey) {
    res.status(400).json({ error: "certName, issuerId, keyId, privateKey are required" });
    return;
  }
  const existing = await db.select().from(groupsTable).where(eq(groupsTable.certName, certName));
  if (existing.length > 0) {
    res.status(409).json({ error: "اسم الشهادة مستخدم مسبقاً" });
    return;
  }
  const [group] = await db.insert(groupsTable).values({
    certName,
    issuerId,
    keyId,
    privateKey,
    email: email || "",
  }).returning();
  res.status(201).json({ ...group, privateKey: "••••••••" });
});

// ─── MUST be before PUT /admin/groups/:id to avoid being caught as id="ipa-url-all"
router.put("/admin/groups/ipa-url-all", async (req, res): Promise<void> => {
  const { ipaUrl } = req.body as { ipaUrl?: string };
  if (!ipaUrl?.trim()) {
    res.status(400).json({ error: "ipaUrl مطلوب" });
    return;
  }

  const allGroups = await db.select({ id: groupsTable.id, downloadSlug: groupsTable.downloadSlug }).from(groupsTable);

  let updatedCount = 0;
  for (const g of allGroups) {
    let slug = g.downloadSlug;
    if (!slug) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = crypto.randomBytes(4).toString("hex");
        const [taken] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.downloadSlug, candidate));
        if (!taken) { slug = candidate; break; }
      }
    }
    await db.update(groupsTable).set({ ipaUrl: ipaUrl.trim(), downloadSlug: slug }).where(eq(groupsTable.id, g.id));
    updatedCount++;
  }

  res.json({ success: true, updatedCount });
});

// ─── SIGN ALL GROUPS ─────────────────────────────────────────────────────────
const SIGNED_STORE_DIR = path.join(process.cwd(), "uploads", "SignedStore");
fs.mkdirSync(SIGNED_STORE_DIR, { recursive: true });

/**
 * Extract the bundle ID from a base64-encoded mobileprovision.
 * Returns null for wildcard profiles (bundle ID = "*" or ends with ".*").
 */
function extractProfileBundleId(mpBase64: string): string | null {
  try {
    const buf  = Buffer.from(mpBase64, "base64");
    const raw  = buf.toString("latin1");
    const xmlMatch = raw.match(/<\?xml[\s\S]*?<\/plist>/);
    if (!xmlMatch) return null;
    const data = plist.parse(xmlMatch[0]) as Record<string, any>;
    const ent  = data["Entitlements"] as Record<string, any> | undefined;
    if (!ent) return null;
    const appId = (ent["application-identifier"] as string | undefined)
      ?.replace(/^[A-Z0-9]+\./, ""); // strip team prefix e.g. "ABCD1234."
    if (!appId || appId === "*" || appId.endsWith(".*")) return null;
    return appId;
  } catch { return null; }
}

/** Build a minimal XML plist from a flat entitlements object. */
function buildEntitlementsPlist(ent: Record<string, any>): string {
  const xmlVal = (v: any): string => {
    if (typeof v === "boolean") return v ? "<true/>" : "<false/>";
    if (typeof v === "string")  return `<string>${v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</string>`;
    if (Array.isArray(v))       return `<array>${v.map(xmlVal).join("")}</array>`;
    if (typeof v === "object" && v !== null) {
      return `<dict>${Object.entries(v).map(([k2, v2]) => `<key>${k2}</key>${xmlVal(v2)}`).join("")}</dict>`;
    }
    return `<string>${String(v)}</string>`;
  };
  const body = Object.entries(ent)
    .map(([k, v]) => `\t<key>${k}</key>\n\t${xmlVal(v)}`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}\n</dict>\n</plist>\n`;
}

router.post("/admin/groups/sign-all", async (req, res): Promise<void> => {
  const { ipaUrl } = req.body as { ipaUrl?: string };
  if (!ipaUrl?.trim()) {
    res.status(400).json({ error: "رابط IPA مطلوب" });
    return;
  }

  try {
    const parsed = new URL(ipaUrl.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      res.status(400).json({ error: "يجب أن يكون الرابط http أو https" });
      return;
    }
    const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "169.254.169.254", "metadata.google.internal"];
    if (blockedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith(".internal"))) {
      res.status(400).json({ error: "رابط غير مسموح" });
      return;
    }
  } catch {
    res.status(400).json({ error: "رابط غير صالح" });
    return;
  }

  const allGroups = await db.select().from(groupsTable);
  const testGroups = allGroups.filter(g => g.groupType === "test_certificate" && g.p12Data && g.mobileprovisionData);

  if (testGroups.length === 0) {
    res.status(400).json({ error: "لا توجد شهادات (test_certificate) مع p12 و mobileprovision" });
    return;
  }

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  let tmpIpaPath = "";
  try {
    tmpIpaPath = path.join("/tmp", `store_${crypto.randomBytes(8).toString("hex")}.ipa`);
    await execFileAsync("curl", ["-L", "-s", "--max-time", "300", "-o", tmpIpaPath, ipaUrl.trim()], {
      timeout: 5 * 60 * 1000,
    });
    if (!fs.existsSync(tmpIpaPath) || fs.statSync(tmpIpaPath).size < 1000) {
      throw new Error("فشل تحميل ملف IPA من الرابط");
    }

    // ── Strip any existing dylibs from the source IPA (Python zipfile — no corruption) ─
    // AdmZip re-compresses ZIP entries with different settings which corrupts
    // Hermes bytecode (main.jsbundle) → immediate crash. Use Python's zipfile
    // module instead — it copies ZipInfo metadata exactly, preserving all content.
    try {
      // Detect dylibs first (dry-run) using Python
      const detectResult = await execFileAsync("python3", ["-c", `
import zipfile, sys
zf = zipfile.ZipFile(sys.argv[1])
dylibs = [i.filename for i in zf.infolist() if i.filename.endswith(".dylib") and not i.filename.endswith("/")]
print("\\n".join(dylibs))
`, tmpIpaPath], { timeout: 30000 });

      const dylibs = detectResult.stdout.trim().split("\n").filter(Boolean);
      if (dylibs.length > 0) {
        console.log(`[sign-all] stripping ${dylibs.length} dylib(s):`, dylibs);
        const cleanIpaPath = tmpIpaPath.replace(".ipa", "_clean.ipa");

        // Use Python zipfile to copy ZIP while excluding dylibs — preserves ALL metadata
        const stripScript = `
import zipfile, sys, json
src, dst = sys.argv[1], sys.argv[2]
exclude = set(json.loads(sys.argv[3]))
with zipfile.ZipFile(src, "r") as zin:
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename in exclude:
                continue
            # writestr(ZipInfo, data) preserves all metadata including external_attr
            zout.writestr(item, zin.read(item.filename))
`;
        await execFileAsync("python3", ["-c", stripScript, tmpIpaPath, cleanIpaPath, JSON.stringify(dylibs)], { timeout: 60000 });
        fs.rmSync(tmpIpaPath, { force: true });
        tmpIpaPath = cleanIpaPath;
        console.log(`[sign-all] dylib strip complete → ${cleanIpaPath}`);
      } else {
        console.log("[sign-all] no dylibs found in IPA — skip strip step");
      }
    } catch (cleanErr: any) {
      console.warn("[sign-all] dylib strip warning:", cleanErr.message);
      // Non-fatal — proceed with original IPA
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Patch EXConstants.bundle/app.config with Python (safe — no corruption) ──
    // Expo SDK with New Architecture reads app.config at startup and may crash
    // if ios.bundleIdentifier doesn't match the actual CFBundleIdentifier.
    // We use Python's zipfile module which copies ZipInfo metadata exactly
    // (no re-compression, no corruption of binary files like main.jsbundle).
    const sourceIpaForPatch = tmpIpaPath;
    try {
      const patchedIpaPath = sourceIpaForPatch.replace(/(_clean)?\.ipa$/, "_patched.ipa");
      const bundleIdToPatch = (() => {
        // Try to get the bundle ID from the provisioning profiles
        for (const group of testGroups) {
          if (group.mobileprovisionData) {
            const bid = extractProfileBundleId(group.mobileprovisionData);
            if (bid && !bid.startsWith("*")) return bid;
          }
        }
        return null;
      })();

      if (bundleIdToPatch) {
        const patchScript = `
import zipfile, sys, json
src, dst, bundle_id = sys.argv[1], sys.argv[2], sys.argv[3]
patched = False
with zipfile.ZipFile(src, "r") as zin:
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if "EXConstants.bundle/app.config" in item.filename:
                try:
                    cfg = json.loads(data.decode("utf-8"))
                    if isinstance(cfg.get("ios"), dict):
                        cfg["ios"]["bundleIdentifier"] = bundle_id
                    if isinstance(cfg.get("android"), dict):
                        cfg["android"]["package"] = bundle_id
                    data = json.dumps(cfg, ensure_ascii=False).encode("utf-8")
                    patched = True
                    print(f"[patch] app.config bundleIdentifier -> {bundle_id}", flush=True)
                except Exception as e:
                    print(f"[patch] warning: {e}", flush=True)
            zout.writestr(item, data)
if not patched:
    print("[patch] app.config not found — skipped", flush=True)
`;
        const patchResult = await execFileAsync("python3", [
          "-c", patchScript,
          sourceIpaForPatch,
          patchedIpaPath,
          bundleIdToPatch
        ], { timeout: 60000 });
        if (patchResult.stdout) console.log("[sign-all] patch:", patchResult.stdout.trim());
        if (fs.existsSync(patchedIpaPath) && fs.statSync(patchedIpaPath).size > 1000) {
          fs.rmSync(sourceIpaForPatch, { force: true });
          tmpIpaPath = patchedIpaPath;
          console.log(`[sign-all] app.config patched safely → ${patchedIpaPath}`);
        } else {
          console.warn("[sign-all] patched IPA missing — using original");
        }
      }
    } catch (patchErr: any) {
      console.warn("[sign-all] app.config patch warning:", patchErr.message);
      // Non-fatal — proceed with original IPA
    }
    // ─────────────────────────────────────────────────────────────────────────

  } catch (err: any) {
    if (tmpIpaPath && fs.existsSync(tmpIpaPath)) fs.rmSync(tmpIpaPath, { force: true });
    res.status(400).json({ error: `فشل تحميل IPA: ${err.message}` });
    return;
  }

  const findZsign = (): string => {
    const candidates = [
      path.join(process.cwd(), "bin", "zsign"),
      path.join(process.cwd(), "artifacts/api-server/bin", "zsign"),
      "/home/runner/workspace/artifacts/api-server/bin/zsign",
    ];
    for (const p of candidates) { if (fs.existsSync(p)) return p; }
    return candidates[0];
  };
  const zsignBin = findZsign();

  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") || "https://app.mismari.com";

  const results: Array<{ groupId: number; certName: string; success: boolean; error?: string; downloadUrl?: string; slug?: string }> = [];

  for (const group of testGroups) {
    const tmpDir = fs.mkdtempSync("/tmp/zsign-store-");
    try {
      const p12Path = path.join(tmpDir, "cert.p12");
      const mpPath = path.join(tmpDir, "app.mobileprovision");
      fs.writeFileSync(p12Path, Buffer.from(group.p12Data!, "base64"));
      fs.writeFileSync(mpPath, Buffer.from(group.mobileprovisionData!, "base64"));

      const signedFilename = `signed_${group.id}_${crypto.randomBytes(6).toString("hex")}.ipa`;
      const outputPath = path.join(SIGNED_STORE_DIR, signedFilename);

      // Remove old signed files for this group (uploads/ and data/SignedStore/)
      const DATA_SIGNED_DIR = path.join(process.cwd(), "data", "SignedStore");
      fs.mkdirSync(DATA_SIGNED_DIR, { recursive: true });
      const oldFiles = fs.readdirSync(SIGNED_STORE_DIR).filter(f => f.startsWith(`signed_${group.id}_`));
      for (const of2 of oldFiles) {
        fs.rmSync(path.join(SIGNED_STORE_DIR, of2), { force: true });
      }
      // Also clean old persisted copies
      try {
        const oldPersisted = fs.readdirSync(DATA_SIGNED_DIR).filter(f => f.startsWith(`signed_${group.id}_`));
        for (const of3 of oldPersisted) fs.rmSync(path.join(DATA_SIGNED_DIR, of3), { force: true });
      } catch { /* ignore */ }

      // Extract bundle ID from the provisioning profile so we can pass it
      // explicitly to zsign via -b. Without this, the Info.plist keeps the
      // original bundle ID while the signing uses the profile's ID → mismatch
      // → iOS kills the app immediately on launch.
      const profileBundleId = extractProfileBundleId(group.mobileprovisionData!);
      if (profileBundleId) console.log(`[sign-all] group ${group.id} → bundle ID: ${profileBundleId}`);

      // NOTE: We intentionally do NOT patch EXConstants.bundle/app.config here.
      // Although zsign changes Info.plist via -b, AdmZip rewrites the entire ZIP
      // which corrupts binary files (main.jsbundle Hermes bytecode) → immediate crash.
      // Expo SDK does NOT validate app.config.ios.bundleIdentifier against the actual
      // CFBundleIdentifier at runtime, so leaving app.config untouched is safe.

      // ── Build minimal entitlements plist ────────────────────────────────────
      // The provisioning profile may contain system-level entitlements
      // (system-extension.install, networkextension, kernel.*, etc.) that iOS
      // AMFI (AppleMobileFileIntegrity) rejects for sideloaded development apps →
      // immediate crash with no UI before any code runs.
      // We keep only the essential entitlements needed for a React Native / Expo app.
      let entitlementsPath: string | null = null;
      try {
        const entExtractScript = `
import subprocess, plistlib, sys, json

mp_path = sys.argv[1]
with open(mp_path, "rb") as f:
    mp_data = f.read()

result = subprocess.run(
    ["openssl", "smime", "-inform", "der", "-verify", "-noverify", "-in", "/dev/stdin"],
    input=mp_data, capture_output=True
)
profile = plistlib.loads(result.stdout)
ent = profile.get("Entitlements", {})

# Whitelist: only entitlements safe for sideloaded dev apps
KEEP = {
    "application-identifier",
    "keychain-access-groups",
    "com.apple.developer.team-identifier",
    "get-task-allow",
    "aps-environment",
    "com.apple.security.application-groups",
    "com.apple.developer.associated-domains",
    "com.apple.developer.push-to-talk",
}

clean = {k: v for k, v in ent.items() if k in KEEP}
print(json.dumps(clean))
`;
        const { stdout } = await execFileAsync("python3", ["-c", entExtractScript, mpPath], { timeout: 15000 });
        const cleanEnt: Record<string, any> = JSON.parse(stdout.trim());
        console.log(`[sign-all] group ${group.id} → minimal entitlements:`, Object.keys(cleanEnt).join(", "));

        // Write minimal entitlements plist
        const entPlistPath = path.join(tmpDir, "entitlements.plist");
        // Build XML plist manually to avoid native plist dependency
        const entXml = buildEntitlementsPlist(cleanEnt);
        fs.writeFileSync(entPlistPath, entXml, "utf8");
        entitlementsPath = entPlistPath;
      } catch (entErr: any) {
        console.warn("[sign-all] entitlements filter warning (using full profile):", entErr.message);
      }
      // ────────────────────────────────────────────────────────────────────────

      const args: string[] = [
        "-k", p12Path,
        "-p", group.p12Password || "",
        "-m", mpPath,
        "-o", outputPath,
        "-z", "6",
      ];
      if (entitlementsPath) { args.push("-e", entitlementsPath); }
      if (profileBundleId) { args.push("-b", profileBundleId); }
      // ⚠️ Do NOT inject dylib here — sign-all signs Mismari+ store app itself.
      // Dylib crashes React Native/Hermes on launch. Dylib is injected only in
      // apps downloaded FROM the store (sign/app, sign/clone, activate, personal).
      args.push(tmpIpaPath);

      await execFileAsync(zsignBin, args, {
        timeout: 10 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error("zsign لم ينتج ملف الخرج");
      }

      // Persist the signed IPA to data/SignedStore/ so it survives redeployment.
      // On next startup, app.ts copies data/SignedStore/ → uploads/SignedStore/.
      try {
        fs.copyFileSync(outputPath, path.join(DATA_SIGNED_DIR, signedFilename));
      } catch (persistErr) {
        // Non-fatal — log and continue; the file is still in uploads/SignedStore/
        console.error("[sign-store] Warning: could not persist to data/SignedStore:", persistErr);
      }

      let slug = group.downloadSlug;
      if (!slug) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = crypto.randomBytes(4).toString("hex");
          const [taken] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.downloadSlug, candidate));
          if (!taken) { slug = candidate; break; }
        }
      }

      // Generate a secure 32-byte random token — embedded in the download URL.
      // iOS itms-services:// cannot send auth headers, so we use a token in
      // the URL itself. Token is stored in DB and validated on every request.
      const ipaDownloadToken = crypto.randomBytes(32).toString("hex");
      const signedIpaUrl = `${baseUrl}/api/sign/dl/${ipaDownloadToken}`;

      await db.update(groupsTable).set({
        ipaUrl: signedIpaUrl,
        storeIpaPath: `/sign/store-files/${signedFilename}`,
        ipaDownloadToken,
        downloadSlug: slug,
      }).where(eq(groupsTable.id, group.id));

      results.push({
        groupId: group.id,
        certName: group.certName,
        success: true,
        downloadUrl: signedIpaUrl,
        slug: slug || undefined,
      });
    } catch (err: any) {
      results.push({
        groupId: group.id,
        certName: group.certName,
        success: false,
        error: err.message || "فشل التوقيع",
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  fs.rmSync(tmpIpaPath, { force: true });

  const successCount = results.filter(r => r.success).length;
  const _finalDylibPath = path.join(process.cwd(), "uploads", "dylibs", "antirevoke.dylib");
  res.json({
    success: true,
    total: testGroups.length,
    successCount,
    failedCount: testGroups.length - successCount,
    hasDylib: fs.existsSync(_finalDylibPath),
    results,
  });
});

router.put("/admin/groups/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(404).json({ error: "Not found" }); return; }
  const { certName, issuerId, keyId, privateKey, email } = req.body;
  const updateData: Record<string, string> = {};
  if (certName !== undefined) updateData.certName = certName;
  if (issuerId !== undefined) updateData.issuerId = issuerId;
  if (keyId !== undefined) updateData.keyId = keyId;
  if (privateKey && privateKey !== "••••••••") updateData.privateKey = privateKey;
  if (email !== undefined) updateData.email = email;
  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "لا توجد بيانات للتحديث" });
    return;
  }
  const [group] = await db.update(groupsTable).set(updateData).where(eq(groupsTable.id, id)).returning();
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...group, privateKey: "••••••••" });
});

router.delete("/admin/groups/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(groupsTable).where(eq(groupsTable.id, id));
  res.sendStatus(204);
});

// ─── REVENUE ───────────────────────────────────────────────────────────────

router.get("/admin/revenue", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await db
    .select({
      planId: subscriptionsTable.planId,
      planName: plansTable.name,
      planNameAr: plansTable.nameAr,
      price: plansTable.price,
      currency: plansTable.currency,
      isActive: subscriptionsTable.isActive,
      createdAt: subscriptionsTable.createdAt,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id));

  let totalRevenue = 0;
  let thisMonthRevenue = 0;
  let totalCount = 0;
  let thisMonthCount = 0;

  const planMap: Record<number, { nameAr: string | null; name: string; price: number; currency: string; count: number; revenue: number }> = {};

  for (const row of rows) {
    if (row.isActive !== "true") continue;
    const price = Number(row.price || 0);
    totalRevenue += price;
    totalCount++;
    if (row.createdAt && row.createdAt >= startOfMonth) {
      thisMonthRevenue += price;
      thisMonthCount++;
    }
    if (row.planId) {
      if (!planMap[row.planId]) {
        planMap[row.planId] = {
          nameAr: row.planNameAr ?? null,
          name: row.planName ?? "غير محدد",
          price,
          currency: row.currency ?? "IQD",
          count: 0,
          revenue: 0,
        };
      }
      planMap[row.planId].count++;
      planMap[row.planId].revenue += price;
    }
  }

  const breakdown = Object.entries(planMap).map(([, v]) => v).sort((a, b) => b.revenue - a.revenue);

  res.json({ totalRevenue, thisMonthRevenue, totalCount, thisMonthCount, breakdown });
});

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────

router.get("/admin/notifications", async (_req, res): Promise<void> => {
  const notifications = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.sentAt))
    .limit(100);
  res.json({ notifications });
});

router.post("/admin/notifications", async (req, res): Promise<void> => {
  const { title, body, target } = req.body;
  if (!title || !body) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }
  if (String(title).length > 200) { res.status(400).json({ error: "العنوان يجب أن يكون أقل من 200 حرف" }); return; }
  if (String(body).length > 1000) { res.status(400).json({ error: "النص يجب أن يكون أقل من 1000 حرف" }); return; }

  const resolvedTarget = target || "all";
  let pushCount: number;

  // target can be "all" or "group:<certName>"
  if (resolvedTarget.startsWith("group:")) {
    const groupCertName = resolvedTarget.replace("group:", "");
    pushCount = await sendBroadcastToGroup(groupCertName, title, body, { type: "broadcast" });
  } else {
    pushCount = await sendBroadcast(title, body, { type: "broadcast" });
  }

  const [notification] = await db
    .insert(notificationsTable)
    .values({ type: "broadcast", title, body, target: resolvedTarget, recipientCount: pushCount })
    .returning();

  auditLog(req, "SEND_NOTIFICATION", "notifications", notification.id, { title, target: resolvedTarget, recipientCount: pushCount }).catch(() => {});
  res.status(201).json({ success: true, notification });
});

router.delete("/admin/notifications/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
  auditLog(req, "DELETE_NOTIFICATION", "notifications", id).catch(() => {});
  res.sendStatus(204);
});

// ─── REVIEWS ────────────────────────────────────────────────────────────────

router.get("/admin/reviews", async (req, res): Promise<void> => {
  const appId = req.query.appId ? Number(req.query.appId) : undefined;
  const rows = await db
    .select({
      id: reviewsTable.id,
      appId: reviewsTable.appId,
      appName: appsTable.name,
      subscriptionId: reviewsTable.subscriptionId,
      subscriberName: reviewsTable.subscriberName,
      phone: reviewsTable.phone,
      rating: reviewsTable.rating,
      text: reviewsTable.text,
      isHidden: reviewsTable.isHidden,
      createdAt: reviewsTable.createdAt,
      subCode: subscriptionsTable.code,
    })
    .from(reviewsTable)
    .leftJoin(appsTable, eq(reviewsTable.appId, appsTable.id))
    .leftJoin(subscriptionsTable, eq(reviewsTable.subscriptionId, subscriptionsTable.id))
    .where(appId ? eq(reviewsTable.appId, appId) : undefined)
    .orderBy(desc(reviewsTable.createdAt));
  res.json({ reviews: rows });
});

router.patch("/admin/reviews/:id/toggle-hidden", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [current] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db
    .update(reviewsTable)
    .set({ isHidden: !current.isHidden })
    .where(eq(reviewsTable.id, id))
    .returning();
  res.json({ review: updated });
});

router.delete("/admin/reviews/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
  res.sendStatus(204);
});

// ─── TRANSLATE ─────────────────────────────────────────────────────────────

router.post("/admin/translate", translateLimiter, async (req, res): Promise<void> => {
  const { text, from, to } = req.body;
  if (!text?.trim()) { res.json({ translated: "" }); return; }
  if (String(text).length > 2000) { res.status(400).json({ error: "النص يجب أن يكون أقل من 2000 حرف" }); return; }

  const srcLang = from || "auto";
  const tgtLang = to || "en";

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${srcLang}&tl=${tgtLang}&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as any;
    const translated = (data[0] || []).map((s: any) => s[0]).join("");
    if (!translated) throw new Error("Empty result");
    res.json({ translated });
  } catch {
    try {
      const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcLang}|${tgtLang}`;
      const resp2 = await fetch(url2);
      const data2 = await resp2.json() as any;
      if (data2?.responseData?.translatedText) {
        res.json({ translated: data2.responseData.translatedText });
        return;
      }
      throw new Error("no result");
    } catch {
      res.json({ translated: text, fallback: true });
    }
  }
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const settings = await db.select().from(settingsTable);
  res.json({ settings });
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const { settings } = req.body;
  if (!Array.isArray(settings) || settings.length === 0) { res.status(400).json({ error: "settings must be non-empty array" }); return; }
  const rows = settings
    .filter((s: any) => typeof s.key === "string" && s.key.trim())
    .map((s: any) => ({ key: s.key.trim(), value: String(s.value ?? "") }));
  if (rows.length > 0) {
    await db.insert(settingsTable)
      .values(rows)
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: sql`excluded.value`, updatedAt: new Date() } });
  }
  const updated = await db.select().from(settingsTable);
  auditLog(req, "UPDATE_SETTINGS", "settings", null, { keys: rows.map((r: any) => r.key) }).catch(() => {});
  res.json({ settings: updated });
});

// ─── ADMINS MANAGEMENT ──────────────────────────────────────────────────────

router.get("/admin/admins", async (req, res): Promise<void> => {
  const self = (req as any).admin;
  if (self.role !== "superadmin") {
    res.status(403).json({ error: "صلاحيات المسؤول الأعلى مطلوبة" }); return;
  }
  const admins = await db
    .select({
      id: adminsTable.id,
      username: adminsTable.username,
      email: adminsTable.email,
      role: adminsTable.role,
      permissions: adminsTable.permissions,
      isActive: adminsTable.isActive,
      createdAt: adminsTable.createdAt,
      lastLoginAt: adminsTable.lastLoginAt,
    })
    .from(adminsTable)
    .orderBy(adminsTable.createdAt);
  res.json({ admins });
});

router.post("/admin/admins", async (req, res): Promise<void> => {
  const self = (req as any).admin;
  if (self.role !== "superadmin") {
    res.status(403).json({ error: "صلاحيات المسؤول الأعلى مطلوبة" }); return;
  }
  const { username, email, password, role, permissions } = req.body as {
    username?: string; email?: string; password?: string;
    role?: string; permissions?: string[];
  };
  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" }); return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }); return;
  }
  try {
    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    const [admin] = await db.insert(adminsTable).values({
      username: username.trim(),
      email: email?.trim() || "",
      passwordHash,
      salt,
      role: role || "admin",
      permissions: JSON.stringify(permissions || []),
      isActive: true,
    }).returning({
      id: adminsTable.id,
      username: adminsTable.username,
      email: adminsTable.email,
      role: adminsTable.role,
    });
    auditLog(req, "CREATE_ADMIN", "admins", admin.id, { username: admin.username, role: admin.role }).catch(() => {});
    sendSecurityAlert("CREATE_ADMIN", (req as any).admin?.username || "غير معروف", req.ip || "", `مشرف جديد: ${admin.username} (${admin.role})`).catch(() => {});
    res.json({ success: true, admin });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "اسم المستخدم موجود مسبقاً" }); return;
    }
    res.status(500).json({ error: "فشل إنشاء المسؤول" });
  }
});

router.put("/admin/admins/:id", async (req, res): Promise<void> => {
  const self = (req as any).admin;
  if (self.role !== "superadmin") {
    res.status(403).json({ error: "صلاحيات المسؤول الأعلى مطلوبة" }); return;
  }
  const id = Number(req.params.id);
  const { email, password, role, permissions, isActive } = req.body as {
    email?: string; password?: string; role?: string;
    permissions?: string[]; isActive?: boolean;
  };

  const updates: Record<string, any> = {};
  if (email !== undefined) updates.email = email.trim();
  if (role !== undefined) updates.role = role;
  if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);
  if (isActive !== undefined) updates.isActive = isActive;
  if (password?.trim()) {
    if (password.length < 8) {
      res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }); return;
    }
    const salt = generateSalt();
    updates.salt = salt;
    updates.passwordHash = hashPassword(password, salt);
  }

  await db.update(adminsTable).set(updates).where(eq(adminsTable.id, id));
  auditLog(req, "UPDATE_ADMIN", "admins", id, { changedFields: Object.keys(updates).filter(k => k !== "passwordHash" && k !== "salt") }).catch(() => {});
  const changedFields = Object.keys(updates).filter(k => k !== "passwordHash" && k !== "salt");
  const hasPasswordChange = !!updates.passwordHash;
  if (hasPasswordChange || changedFields.includes("role")) {
    sendSecurityAlert("UPDATE_ADMIN", (req as any).admin?.username || "غير معروف", req.ip || "", `مشرف #${id} — الحقول: ${changedFields.join(", ")}${hasPasswordChange ? " + كلمة المرور" : ""}`).catch(() => {});
  }
  res.json({ success: true });
});

router.delete("/admin/admins/:id", async (req, res): Promise<void> => {
  const self = (req as any).admin;
  if (self.role !== "superadmin") {
    res.status(403).json({ error: "صلاحيات المسؤول الأعلى مطلوبة" }); return;
  }
  const id = Number(req.params.id);
  if (id === self.adminId) {
    res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" }); return;
  }
  await db.delete(adminsTable).where(eq(adminsTable.id, id));
  auditLog(req, "DELETE_ADMIN", "admins", id).catch(() => {});
  sendSecurityAlert("DELETE_ADMIN", (req as any).admin?.username || "غير معروف", req.ip || "", `تم حذف المشرف #${id}`).catch(() => {});
  res.json({ success: true });
});

// ─── GET /admin/balances — stats + all transactions ──────────────────────────
router.get("/admin/balances", async (req, res): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const typeFilter = (req.query.type as string) || "";
    const search = ((req.query.search as string) || "").trim();

    // Stats
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_transactions,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0)::int AS total_credited,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0)::int AS total_debited,
        COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END), 0)::int AS total_purchased,
        COUNT(DISTINCT subscription_id)::int AS subscribers_with_tx
      FROM balance_transactions
    `);
    const stats = statsResult.rows[0] as any || {};

    const balanceStatsResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(balance), 0)::int AS total_balance_in_system,
        COUNT(*)::int AS subscribers_count
      FROM subscriptions
    `);
    const balanceStats = balanceStatsResult.rows[0] as any || {};

    // Transactions list — use parameterized sql`` to prevent SQL injection
    const whereParts: any[] = [];
    if (typeFilter && ["credit", "debit", "purchase"].includes(typeFilter)) {
      whereParts.push(sql`bt.type = ${typeFilter}`);
    }
    if (search) {
      const pat = `%${search}%`;
      whereParts.push(sql`(s.subscriber_name ILIKE ${pat} OR s.phone ILIKE ${pat} OR s.code ILIKE ${pat})`);
    }
    const whereSql = whereParts.length > 0
      ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
      : sql``;

    const rowsResult = await db.execute(
      sql`
        SELECT
          bt.id,
          bt.type,
          bt.amount,
          bt.balance_after,
          bt.note,
          bt.created_at,
          s.id AS subscription_id,
          s.code,
          s.subscriber_name,
          s.phone,
          a.username AS admin_username
        FROM balance_transactions bt
        JOIN subscriptions s ON s.id = bt.subscription_id
        LEFT JOIN admins a ON a.id = bt.admin_id
        ${whereSql}
        ORDER BY bt.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    );
    const rows = rowsResult.rows;

    const countResult = await db.execute(
      sql`
        SELECT COUNT(*)::int AS total
        FROM balance_transactions bt
        JOIN subscriptions s ON s.id = bt.subscription_id
        ${whereSql}
      `
    );
    const countRow = countResult.rows[0] as any || {};

    res.json({
      stats: {
        totalTransactions: stats.total_transactions || 0,
        totalCredited: stats.total_credited || 0,
        totalDebited: stats.total_debited || 0,
        totalPurchased: stats.total_purchased || 0,
        subscribersWithTx: stats.subscribers_with_tx || 0,
        totalBalanceInSystem: balanceStats.total_balance_in_system || 0,
        subscribersCount: balanceStats.subscribers_count || 0,
      },
      transactions: rows,
      total: countRow.total || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("[admin/balances] error:", err);
    res.status(500).json({ error: "خطأ في جلب بيانات الأرصدة" });
  }
});

// ─── POST /admin/subscriptions/:id/balance — credit or debit balance ─────────
router.post("/admin/subscriptions/:id/balance", async (req, res): Promise<void> => {
  const self = (req as any).admin;
  const id = Number(req.params.id);
  const { type, amount, note } = req.body as { type: string; amount: number; note?: string };

  if (!["credit", "debit"].includes(type)) {
    res.status(400).json({ error: "نوع العملية غير صحيح — credit أو debit" }); return;
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "المبلغ يجب أن يكون أكبر من صفر" }); return;
  }

  try {
    const [sub] = await db.select({ id: subscriptionsTable.id, balance: subscriptionsTable.balance, code: subscriptionsTable.code, name: subscriptionsTable.subscriberName })
      .from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
    if (!sub) { res.status(404).json({ error: "المشترك غير موجود" }); return; }

    const newBalance = type === "credit"
      ? sub.balance + amount
      : Math.max(0, sub.balance - amount);

    await db.update(subscriptionsTable).set({ balance: newBalance }).where(eq(subscriptionsTable.id, id));

    await db.insert(balanceTransactionsTable).values({
      subscriptionId: id,
      type,
      amount,
      balanceAfter: newBalance,
      note: note?.trim() || null,
      adminId: self.adminId ?? null,
    });

    res.json({ success: true, balance: newBalance, type, amount });
  } catch (err) {
    console.error("[admin/balance] error:", err);
    res.status(500).json({ error: "خطأ في تعديل الرصيد" });
  }
});

// ─── GET /admin/subscriptions/:id/balance — get balance + recent txs ─────────
router.get("/admin/subscriptions/:id/balance", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  try {
    const [sub] = await db.select({ balance: subscriptionsTable.balance, code: subscriptionsTable.code, subscriberName: subscriptionsTable.subscriberName })
      .from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
    if (!sub) { res.status(404).json({ error: "غير موجود" }); return; }

    const txs = await db.select({
      id: balanceTransactionsTable.id,
      type: balanceTransactionsTable.type,
      amount: balanceTransactionsTable.amount,
      balanceAfter: balanceTransactionsTable.balanceAfter,
      note: balanceTransactionsTable.note,
      createdAt: balanceTransactionsTable.createdAt,
    }).from(balanceTransactionsTable)
      .where(eq(balanceTransactionsTable.subscriptionId, id))
      .orderBy(desc(balanceTransactionsTable.createdAt))
      .limit(20);

    res.json({ balance: sub.balance, transactions: txs });
  } catch (err) {
    res.status(500).json({ error: "خطأ" });
  }
});

// ─── POST /admin/subscriptions/:id/ai-toggle — enable/disable AI access ──────
router.post("/admin/subscriptions/:id/ai-toggle", adminAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { enable, durationDays } = req.body as { enable: boolean; durationDays?: number };

  try {
    const [sub] = await db.select({ id: subscriptionsTable.id, aiEnabled: subscriptionsTable.aiEnabled })
      .from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
    if (!sub) { res.status(404).json({ error: "المشترك غير موجود" }); return; }

    let aiExpiresAt: Date | null = null;
    if (enable && durationDays && durationDays > 0) {
      aiExpiresAt = new Date();
      aiExpiresAt.setDate(aiExpiresAt.getDate() + durationDays);
    }

    await db.update(subscriptionsTable)
      .set({ aiEnabled: enable, aiExpiresAt: enable ? aiExpiresAt : null })
      .where(eq(subscriptionsTable.id, id));

    res.json({ success: true, aiEnabled: enable, aiExpiresAt });
  } catch (err) {
    console.error("[admin/ai-toggle] error:", err);
    res.status(500).json({ error: "خطأ في تعديل صلاحية الذكاء الاصطناعي" });
  }
});

// ─── Anti-Revoke Dylib Upload / Status / Delete ──────────────────────────────
const DYLIB_UPLOAD_DIR = path.join(process.cwd(), "uploads", "dylibs");
const DYLIB_DATA_DIR   = path.join(process.cwd(), "data");
const DYLIB_PATH       = path.join(DYLIB_UPLOAD_DIR, "antirevoke.dylib");
const DYLIB_PERSIST    = path.join(DYLIB_DATA_DIR,   "antirevoke.dylib");

fs.mkdirSync(DYLIB_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DYLIB_DATA_DIR,   { recursive: true });

const dylibStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DYLIB_UPLOAD_DIR),
  filename:    (_req, _file, cb) => cb(null, "antirevoke.dylib"),
});
const dylibUpload = multer({
  storage: dylibStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith(".dylib")) return cb(null, true);
    cb(new Error("يُقبل فقط ملفات .dylib"));
  },
});

router.get("/admin/dylib/status", adminAuth, (_req, res): void => {
  try {
    if (fs.existsSync(DYLIB_PATH)) {
      const stat = fs.statSync(DYLIB_PATH);
      res.json({ exists: true, size: stat.size, updatedAt: stat.mtime.toISOString() });
    } else {
      res.json({ exists: false });
    }
  } catch {
    res.json({ exists: false });
  }
});

router.post("/admin/dylib/upload", adminAuth, dylibUpload.single("file"), (req, res): void => {
  try {
    if (!req.file) { res.status(400).json({ error: "لم يُرسل أي ملف" }); return; }
    fs.copyFileSync(DYLIB_PATH, DYLIB_PERSIST);
    const stat = fs.statSync(DYLIB_PATH);
    r2Upload("dylibs/antirevoke.dylib", fs.readFileSync(DYLIB_PATH), "application/octet-stream").catch(() => {});
    res.json({ success: true, size: stat.size });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل الرفع" });
  }
});

router.delete("/admin/dylib", adminAuth, (_req, res): void => {
  try {
    if (fs.existsSync(DYLIB_PATH))    fs.unlinkSync(DYLIB_PATH);
    if (fs.existsSync(DYLIB_PERSIST)) fs.unlinkSync(DYLIB_PERSIST);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل الحذف" });
  }
});

// ─── Store Dylib Upload / Status / Delete ─────────────────────────────────────
// mismari-store.dylib — يُحقن في تطبيق مسماري+ (المتجر) فقط
// ⚠️  لا يُحقن في تطبيقات المستخدمين — راجع sign.ts و activate.ts
const STORE_DYLIB_UPLOAD_PATH = path.join(DYLIB_UPLOAD_DIR, "mismari-store.dylib");
const STORE_DYLIB_PERSIST     = path.join(DYLIB_DATA_DIR,   "mismari-store.dylib");

const storeDylibStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DYLIB_UPLOAD_DIR),
  filename:    (_req, _file, cb) => cb(null, "mismari-store.dylib"),
});
const storeDylibUpload = multer({
  storage: storeDylibStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith(".dylib")) return cb(null, true);
    cb(new Error("يُقبل فقط ملفات .dylib"));
  },
});

router.get("/admin/store-dylib/status", adminAuth, (_req, res): void => {
  try {
    if (fs.existsSync(STORE_DYLIB_UPLOAD_PATH)) {
      const stat = fs.statSync(STORE_DYLIB_UPLOAD_PATH);
      res.json({ exists: true, size: stat.size, updatedAt: stat.mtime.toISOString() });
    } else {
      res.json({ exists: false });
    }
  } catch {
    res.json({ exists: false });
  }
});

router.post("/admin/store-dylib/upload", adminAuth, storeDylibUpload.single("file"), (req, res): void => {
  try {
    if (!req.file) { res.status(400).json({ error: "لم يُرسل أي ملف" }); return; }
    // Remove .disabled sentinel so the new dylib will be used
    enableDylib(STORE_DYLIB_PATH);
    fs.copyFileSync(STORE_DYLIB_UPLOAD_PATH, STORE_DYLIB_PERSIST);
    const stat = fs.statSync(STORE_DYLIB_UPLOAD_PATH);
    r2Upload("dylibs/mismari-store.dylib", fs.readFileSync(STORE_DYLIB_UPLOAD_PATH), "application/octet-stream").catch(() => {});
    auditLog(req, "UPLOAD_DYLIB", "dylib", "mismari-store.dylib", { size: stat.size }).catch(() => {});
    sendSecurityAlert("UPLOAD_DYLIB", (req as any).admin?.username || "غير معروف", req.ip || "", `الحجم: ${(stat.size / 1024).toFixed(1)} KB`).catch(() => {});
    res.json({ success: true, size: stat.size });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل الرفع" });
  }
});

router.delete("/admin/store-dylib", adminAuth, (_req, res): void => {
  try {
    // Disable the dylib: delete local file + etag + create .disabled sentinel
    // (prevents auto-re-download from R2 CDN on next sign request)
    disableDylib(STORE_DYLIB_PATH);
    // Attempt R2 delete as well (best-effort, may fail if credentials absent)
    r2Delete("dylibs/mismari-store.dylib").catch(() => {});
    auditLog(_req as any, "DELETE_DYLIB", "dylib", "mismari-store.dylib").catch(() => {});
    sendSecurityAlert("DELETE_DYLIB", (_req as any).admin?.username || "غير معروف", _req.ip || "", "تم حذف ملف mismari-store.dylib").catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل الحذف" });
  }
});

// ─── AUDIT LOGS ─────────────────────────────────────────────────────────────

router.get("/admin/audit-logs", async (req, res): Promise<void> => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const adminFilter   = req.query.adminId ? Number(req.query.adminId) : undefined;
  const actionFilter  = req.query.action  ? String(req.query.action)  : undefined;
  const resourceFilter = req.query.resource ? String(req.query.resource) : undefined;

  const where = and(
    adminFilter   ? eq(adminAuditLogsTable.adminId, adminFilter) : undefined,
    actionFilter  ? eq(adminAuditLogsTable.action,  actionFilter) : undefined,
    resourceFilter ? eq(adminAuditLogsTable.resource, resourceFilter) : undefined,
  );

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminAuditLogsTable)
    .where(where);

  const logs = await db
    .select()
    .from(adminAuditLogsTable)
    .where(where)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ logs, total, page, limit });
});

export default router;
