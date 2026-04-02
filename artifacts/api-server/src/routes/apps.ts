import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ilike, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, appsTable, categoriesTable, settingsTable, featuredBannersTable, appPlansTable, subscriptionsTable, notificationsTable, dylibEventsTable } from "@workspace/db";
import {
  ListAppsQueryParams,
  ListAppsResponse,
  ListFeaturedAppsResponse,
  ListHotAppsResponse,
  GetAppParams,
  GetAppResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Rebuild the icon URL dynamically using the current request's host.
 * Stored icon URLs use an old dev domain that changes on restart.
 * iconPath (e.g. /admin/FilesIPA/Icons/abc.png) is always stable.
 */
function resolveIconUrl(req: any, icon: string, iconPath: string | null | undefined): string {
  if (iconPath) {
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "localhost";
    return `${proto}://${host}${iconPath}`;
  }
  return icon; // base64 or non-path icon (e.g. emoji / feather icon name)
}

router.get("/apps", async (req, res): Promise<void> => {
  const query = ListAppsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { categoryId, filter, search, page = 1, limit = 20 } = query.data;
  const section = (req.query as any).section as string | undefined;
  const code = (req.query as any).code as string | undefined;
  const offset = (page - 1) * limit;

  // Resolve subscriber's planId if code provided — only for active, non-expired subscriptions
  let subscriberPlanId: number | null = null;
  if (code) {
    const [sub] = await db
      .select({ planId: subscriptionsTable.planId, isActive: subscriptionsTable.isActive, expiresAt: subscriptionsTable.expiresAt })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.code, code))
      .limit(1);
    if (sub && sub.isActive === "true" && (!sub.expiresAt || sub.expiresAt > new Date())) {
      subscriberPlanId = sub.planId;
    }
  }

  // If subscriber plan is known, filter: show apps that have no plan restriction OR have this plan
  let planFilteredAppIds: number[] | null = null;
  if (subscriberPlanId !== null) {
    // Apps with this plan in app_plans
    const planApps = await db
      .select({ appId: appPlansTable.appId })
      .from(appPlansTable)
      .where(eq(appPlansTable.planId, subscriberPlanId));
    const planAppIdSet = new Set(planApps.map(r => r.appId));

    // Apps with any plan restriction at all
    const allRestrictedApps = await db
      .select({ appId: appPlansTable.appId })
      .from(appPlansTable);
    const allRestrictedSet = new Set(allRestrictedApps.map(r => r.appId));

    // An app is visible if: it has NO restriction OR it's in subscriber's plan
    // We'll collect all restricted app IDs not in subscriber's plan → exclude them
    const excludedIds = [...allRestrictedSet].filter(id => !planAppIdSet.has(id));
    planFilteredAppIds = excludedIds; // IDs to EXCLUDE
  }

  const conditions = [eq(appsTable.isHidden, false)];
  if (planFilteredAppIds !== null && planFilteredAppIds.length > 0) {
    conditions.push(sql`${appsTable.id} NOT IN (${sql.raw(planFilteredAppIds.join(","))})`);
  }
  if (categoryId) conditions.push(eq(appsTable.categoryId, categoryId));
  if (section === "most_downloaded") {
    conditions.push(sql`${appsTable.downloads} > 0`);
  } else if (section === "trending") {
    conditions.push(eq(appsTable.isHot, true));
  } else if (section === "latest") {
    // show most recently added apps (no date filter)
  } else if (filter && filter !== "all") {
    if (filter === "hot") conditions.push(eq(appsTable.isHot, true));
    else if (filter === "new") conditions.push(sql`${appsTable.createdAt} > NOW() - INTERVAL '30 days'`);
    else conditions.push(eq(appsTable.tag, filter));
  }
  if (search) conditions.push(ilike(appsTable.name, `%${search}%`));

  const whereClause = and(...conditions);
  const orderClause = section === "most_downloaded"
    ? desc(appsTable.downloads)
    : section === "trending"
    ? desc(appsTable.isHot)
    : desc(appsTable.createdAt);

  const apps = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      descriptionAr: appsTable.descriptionAr,
      descriptionEn: appsTable.descriptionEn,
      icon: appsTable.icon,
      iconPath: appsTable.iconPath,
      categoryId: appsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryNameAr: categoriesTable.nameAr,
      tag: appsTable.tag,
      version: appsTable.version,
      size: appsTable.size,
      downloads: appsTable.downloads,
      isFeatured: appsTable.isFeatured,
      isHot: appsTable.isHot,
      createdAt: appsTable.createdAt,
      bundleId: appsTable.bundleId,
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

  res.json(
    ListAppsResponse.parse({
      apps: apps.map((a) => ({
        ...a,
        icon: resolveIconUrl(req, a.icon, a.iconPath),
        description: a.description ?? undefined,
        descriptionAr: a.descriptionAr ?? undefined,
        descriptionEn: a.descriptionEn ?? undefined,
        categoryName: a.categoryName ?? "Unknown",
        categoryNameAr: a.categoryNameAr ?? undefined,
      })),
      total: count,
      page,
      limit,
    })
  );
});

router.get("/apps/featured", async (req, res): Promise<void> => {
  const apps = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      descriptionAr: appsTable.descriptionAr,
      descriptionEn: appsTable.descriptionEn,
      icon: appsTable.icon,
      iconPath: appsTable.iconPath,
      categoryId: appsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryNameAr: categoriesTable.nameAr,
      tag: appsTable.tag,
      version: appsTable.version,
      size: appsTable.size,
      downloads: appsTable.downloads,
      isFeatured: appsTable.isFeatured,
      isHot: appsTable.isHot,
      createdAt: appsTable.createdAt,
    })
    .from(appsTable)
    .leftJoin(categoriesTable, eq(appsTable.categoryId, categoriesTable.id))
    .where(eq(appsTable.isFeatured, true))
    .orderBy(desc(appsTable.downloads))
    .limit(10);

  res.json(
    ListFeaturedAppsResponse.parse({
      apps: apps.map((a) => ({
        ...a,
        icon: resolveIconUrl(req, a.icon, a.iconPath),
        description: a.description ?? undefined,
        descriptionAr: a.descriptionAr ?? undefined,
        descriptionEn: a.descriptionEn ?? undefined,
        categoryName: a.categoryName ?? "Unknown",
        categoryNameAr: a.categoryNameAr ?? undefined,
      })),
      total: apps.length,
    })
  );
});

router.get("/apps/hot", async (req, res): Promise<void> => {
  const apps = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      descriptionAr: appsTable.descriptionAr,
      descriptionEn: appsTable.descriptionEn,
      icon: appsTable.icon,
      iconPath: appsTable.iconPath,
      categoryId: appsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryNameAr: categoriesTable.nameAr,
      tag: appsTable.tag,
      version: appsTable.version,
      size: appsTable.size,
      downloads: appsTable.downloads,
      isFeatured: appsTable.isFeatured,
      isHot: appsTable.isHot,
      createdAt: appsTable.createdAt,
    })
    .from(appsTable)
    .leftJoin(categoriesTable, eq(appsTable.categoryId, categoriesTable.id))
    .where(eq(appsTable.isHot, true))
    .orderBy(desc(appsTable.downloads))
    .limit(10);

  res.json(
    ListHotAppsResponse.parse({
      apps: apps.map((a) => ({
        ...a,
        icon: resolveIconUrl(req, a.icon, a.iconPath),
        description: a.description ?? undefined,
        descriptionAr: a.descriptionAr ?? undefined,
        descriptionEn: a.descriptionEn ?? undefined,
        categoryName: a.categoryName ?? "Unknown",
        categoryNameAr: a.categoryNameAr ?? undefined,
      })),
      total: apps.length,
    })
  );
});

router.get("/apps/:id", async (req, res): Promise<void> => {
  const params = GetAppParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [app] = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      descriptionAr: appsTable.descriptionAr,
      descriptionEn: appsTable.descriptionEn,
      icon: appsTable.icon,
      iconPath: appsTable.iconPath,
      categoryId: appsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryNameAr: categoriesTable.nameAr,
      tag: appsTable.tag,
      version: appsTable.version,
      size: appsTable.size,
      downloads: appsTable.downloads,
      isFeatured: appsTable.isFeatured,
      isHot: appsTable.isHot,
      createdAt: appsTable.createdAt,
    })
    .from(appsTable)
    .leftJoin(categoriesTable, eq(appsTable.categoryId, categoriesTable.id))
    .where(eq(appsTable.id, params.data.id));

  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }

  res.json(GetAppResponse.parse({
    ...app,
    icon: resolveIconUrl(req, app.icon, app.iconPath),
    description: app.description ?? undefined,
    descriptionAr: app.descriptionAr ?? undefined,
    descriptionEn: app.descriptionEn ?? undefined,
    categoryName: app.categoryName ?? "Unknown",
    categoryNameAr: app.categoryNameAr ?? undefined,
  }));
});

// ─── PUBLIC SETTINGS ──────────────────────────────────────────────────────

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json({
    instagram: map.support_instagram || "",
    telegram: map.support_telegram || "",
    whatsapp: map.support_whatsapp || "",
    storeName: map.store_name || "مسماري",
    storeDescription: map.store_description || "",
  });
});

router.get("/banners", async (_req, res): Promise<void> => {
  const banners = await db.select().from(featuredBannersTable).where(eq(featuredBannersTable.isActive, true)).orderBy(featuredBannersTable.sortOrder);
  res.json({ banners });
});

// ═══════════════════════════════════════════════════════════════════════════
// API v2 — Dylib Endpoints (AES-128-CBC encrypted responses)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * يشفّر كائن JS إلى AES-128-CBC ويُعيد { msm_enc, msm_iv } بصيغة Base64.
 * المفتاح: MSM_PAYLOAD_KEY من .env، أو القيمة الافتراضية لغرض التطوير فقط.
 * ⚠️  غيّر MSM_PAYLOAD_KEY في الإنتاج وحدّث _ENC_AESKEY في Obfuscation.h معه.
 */
function msmEncrypt(payload: object): { msm_enc: string; msm_iv: string } {
  const key = Buffer.from(
    process.env.MSM_PAYLOAD_KEY ?? "Msm@Store#2026!K",
    "utf8"
  ).slice(0, 16);                          // AES-128 = 16 bytes
  const iv  = crypto.randomBytes(16);      // IV عشوائي لكل response
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  const json = JSON.stringify(payload);
  const enc  = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  return {
    msm_enc: enc.toString("base64"),
    msm_iv:  iv.toString("base64"),
  };
}

// ─── GET /api/v2/dylib/settings ─────────────────────────────────────────────
// يُستخدم من mismari-store.dylib فقط — الـ response مشفّر AES-128-CBC
//
// حقول الـ Payload (يجب أن تطابق Obfuscation.h في الدايلب):
//   storeVersion   ← _ENC_UPDATE_KEY  = "storeVersion"
//   storeNotes     ← _ENC_STORE_NOTES = "storeNotes"
//   isForceUpdate  ← _ENC_ISFORCEUPDATE = "isForceUpdate"
//
// ⚠️ كان الاسم "releaseNotes" خطأ — الدايلب يتوقع "storeNotes" (تم الإصلاح)
router.get("/v2/dylib/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const payload = {
    // ─── يُقرأ من جدول settings في قاعدة البيانات ────────────────────────
    storeVersion:      map.store_version          || "1.0",
    storeNotes:        map.store_notes            || "تحسينات وإصلاحات.",    // ← إصلاح: كان releaseNotes
    storeName:         map.store_name             || "مسماري",
    minVersion:        map.min_version            || "1.0",
    isMaintenanceMode: map.maintenance_mode       === "true",

    // ─── Force Update: true = المستخدم مجبور على التحديث (زر "لاحقاً" يُغلق التطبيق) ──
    // غيّر قيمة `force_update` في جدول settings لتفعيل/إلغاء الإجبار
    isForceUpdate:     map.force_update           === "true",

    // ─── Kill-Switch: true = تعطيل جميع الـ Hooks طارئاً (Modules 3-6) ──────────
    disableHooks:      map.disable_hooks          === "true",

    // ─── Welcome Message: نص رسالة الترحيب الديناميكية (Module 12) ─────────────
    welcomeMessage:    map.welcome_message        || "",
  };

  res.json(msmEncrypt(payload));
});

// ─── POST /api/v2/telemetry/proxy ───────────────────────────────────────────
// يستقبل تقارير صامتة من الـ dylib عند اكتشاف VPN أو Proxy تجسس
// type = "vpn" | "spy" | "safe_mode" | "integrity_fail"
router.post("/v2/telemetry/proxy", async (req, res): Promise<void> => {
  const type       = req.body?.type       ?? "unknown";
  const subType    = req.body?.subType    ?? "";
  const bundleId   = req.body?.bundleId   ?? "";
  const appVersion = req.body?.appVersion ?? "";
  const extra      = req.body?.extra      ?? {};
  const ua         = req.headers["user-agent"] ?? "";
  const ip         = (req.headers["x-forwarded-for"] as string | undefined)
                        ?.split(",")[0]?.trim()
                     ?? req.socket.remoteAddress
                     ?? "0.0.0.0";

  console.log(`[telemetry/proxy] type=${type} subType=${subType} ip=${ip} ua=${ua.slice(0, 60)}`);

  try {
    await db.insert(dylibEventsTable).values({
      eventType:  type,
      subType:    String(subType),
      ip:         String(ip),
      userAgent:  String(ua).slice(0, 300),
      bundleId:   String(bundleId),
      appVersion: String(appVersion),
      extra:      JSON.stringify(extra),
    });
  } catch (err) {
    console.error("[telemetry/proxy] DB insert error:", err);
  }

  res.status(204).end();
});

router.get("/admin/banner-image/:filename", (req, res): void => {
  const filename = path.basename(req.params.filename);
  if (filename.includes("..")) { res.status(400).send("Invalid"); return; }
  const filePath = path.join(process.cwd(), "uploads", "banners", filename);
  if (!fs.existsSync(filePath)) { res.status(404).send("Not found"); return; }
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(filePath);
});

// ─── PUBLIC NOTIFICATIONS ─────────────────────────────────────────────────────
// Returns all notifications (broadcast + app events) ordered newest first.
// The mobile app polls this to show notifications without depending on push.
router.get("/notifications", async (_req, res): Promise<void> => {
  const notifications = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.sentAt))
    .limit(100);
  res.json({ notifications });
});

export default router;
