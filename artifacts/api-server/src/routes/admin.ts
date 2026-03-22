import { Router, type IRouter } from "express";
import { eq, desc, sql, ilike, or, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db, appsTable, categoriesTable, plansTable, subscriptionsTable, featuredBannersTable, settingsTable, groupsTable, notificationsTable } from "@workspace/db";
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

const router: IRouter = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.username === ADMIN_USERNAME && parsed.data.password === ADMIN_PASSWORD) {
    const token = Buffer.from(`${parsed.data.username}:${Date.now()}`).toString("base64");
    res.json(AdminLoginResponse.parse({ success: true, token }));
  } else {
    res.status(401).json(AdminLoginResponse.parse({ success: false, token: "" }));
  }
});

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

  res.json(
    AdminListAppsResponse.parse({
      apps: apps.map((a) => ({
        ...a,
        categoryName: a.categoryName ?? "Unknown",
        isHidden: a.isHidden ?? false,
        isTestMode: a.isTestMode ?? false,
        status: a.status ?? "active",
      })),
      total: count,
      page,
      limit,
    })
  );
});

router.post("/admin/apps", async (req, res): Promise<void> => {
  const parsed = AdminCreateAppBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [app] = await db.insert(appsTable).values(parsed.data).returning();

  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, app.categoryId));

  res.status(201).json({ ...app, categoryName: category?.name ?? "Unknown" });
});

router.put("/admin/apps/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateAppParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminUpdateAppBody.safeParse(req.body);
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

  const [category] = await db
    .select({ name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, app.categoryId));

  res.json({ ...app, categoryName: category?.name ?? "Unknown" });
});

router.patch("/admin/apps/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [app] = await db.update(appsTable).set(req.body).where(eq(appsTable.id, id)).returning();
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
      const full = path.join(uploadsDir, relPath.replace(/^\/admin\/FilesIPA\//, "FilesIPA/"));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {}
  };
  tryDelete(app.ipaPath);
  tryDelete(app.iconPath);

  res.sendStatus(204);
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
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (search) {
    conditions.push(or(
      ilike(subscriptionsTable.subscriberName, `%${search}%`),
      ilike(subscriptionsTable.phone, `%${search}%`),
      ilike(subscriptionsTable.email, `%${search}%`),
      ilike(subscriptionsTable.code, `%${search}%`),
      ilike(subscriptionsTable.udid, `%${search}%`),
    ));
  }

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
      activatedAt: subscriptionsTable.activatedAt,
      expiresAt: subscriptionsTable.expiresAt,
      createdAt: subscriptionsTable.createdAt,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(subscriptionsTable);

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
  res.sendStatus(204);
});

// Delete multiple subscriptions
router.post("/admin/subscriptions/bulk-delete", async (req, res): Promise<void> => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids required" }); return; }
  for (const id of ids) {
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.id, Number(id)));
  }
  res.json({ deleted: ids.length });
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

// GET /admin/groups — reads from local cache (fast, no Apple API call)
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

router.put("/admin/groups/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { certName, issuerId, keyId, privateKey, email } = req.body;
  const updateData: Record<string, string> = {};
  if (certName !== undefined) updateData.certName = certName;
  if (issuerId !== undefined) updateData.issuerId = issuerId;
  if (keyId !== undefined) updateData.keyId = keyId;
  if (privateKey && privateKey !== "••••••••") updateData.privateKey = privateKey;
  if (email !== undefined) updateData.email = email;
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

  const [{ totalActive }] = await db
    .select({ totalActive: sql<number>`count(*)::int` })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.isActive, "true"));

  const recipientCount = target === "all" ? totalActive : 0;

  const [notification] = await db
    .insert(notificationsTable)
    .values({ title, body, target: target || "all", recipientCount })
    .returning();

  res.status(201).json({ success: true, notification });
});

router.delete("/admin/notifications/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
  res.sendStatus(204);
});

// ─── TRANSLATE ─────────────────────────────────────────────────────────────

router.post("/admin/translate", async (req, res): Promise<void> => {
  const { text, from, to } = req.body;
  if (!text?.trim()) { res.json({ translated: "" }); return; }

  const LANG_MAP: Record<string, string> = { ar: "ar", en: "en", auto: "auto" };
  const srcLang = LANG_MAP[from] || "auto";
  const tgtLang = LANG_MAP[to] || "en";

  try {
    const resp = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: srcLang,
        target: tgtLang,
        format: "text",
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as any;
    res.json({ translated: data.translatedText || text });
  } catch {
    // Fallback: return original text
    res.json({ translated: text, fallback: true });
  }
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const settings = await db.select().from(settingsTable);
  res.json({ settings });
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const { settings } = req.body;
  if (!Array.isArray(settings)) { res.status(400).json({ error: "settings must be array" }); return; }
  for (const s of settings) {
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, s.key));
    if (existing.length > 0) {
      await db.update(settingsTable).set({ value: s.value }).where(eq(settingsTable.key, s.key));
    } else {
      await db.insert(settingsTable).values({ key: s.key, value: s.value });
    }
  }
  const updated = await db.select().from(settingsTable);
  res.json({ settings: updated });
});

export default router;
