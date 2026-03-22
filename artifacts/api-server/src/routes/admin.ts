import { Router, type IRouter } from "express";
import { eq, desc, sql, ilike, or } from "drizzle-orm";
import { db, appsTable, categoriesTable, plansTable, subscriptionsTable, featuredBannersTable, settingsTable, groupsTable } from "@workspace/db";
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
  const search = (req.query as any).search as string | undefined;

  const conditions: any[] = [];
  if (search) {
    conditions.push(or(
      ilike(appsTable.name, `%${search}%`),
      ilike(appsTable.bundleId, `%${search}%`)
    ));
  }

  const apps = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      icon: appsTable.icon,
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
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(appsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(appsTable);

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

  res.sendStatus(204);
});

// ─── CATEGORIES ────────────────────────────────────────────────────────────

router.get("/admin/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      nameAr: categoriesTable.nameAr,
      icon: categoriesTable.icon,
      appCount: sql<number>`(SELECT count(*) FROM apps WHERE apps.category_id = ${categoriesTable.id})::int`,
    })
    .from(categoriesTable);

  res.json(AdminListCategoriesResponse.parse({ categories }));
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
      deviceType: subscriptionsTable.deviceType,
      subscriberName: subscriptionsTable.subscriberName,
      groupName: subscriptionsTable.groupName,
      planId: subscriptionsTable.planId,
      planName: plansTable.name,
      planNameAr: plansTable.nameAr,
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
  const { code, udid, phone, deviceType, subscriberName, groupName, planId, isActive, activatedAt, expiresAt } = req.body;
  if (!code || !planId) { res.status(400).json({ error: "code and planId are required" }); return; }

  const [sub] = await db.insert(subscriptionsTable).values({
    code,
    udid: udid || null,
    phone: phone || null,
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
  const { code, udid, phone, deviceType, subscriberName, groupName, planId, isActive, expiresAt } = req.body;
  const [sub] = await db.update(subscriptionsTable).set({
    ...(code !== undefined && { code }),
    ...(udid !== undefined && { udid }),
    ...(phone !== undefined && { phone }),
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
  const { title, description, image, link, isActive } = req.body;
  const [count] = await db.select({ c: sql<number>`count(*)::int` }).from(featuredBannersTable);
  const [banner] = await db.insert(featuredBannersTable).values({
    title: title || "",
    description: description || "",
    image: image || "",
    link: link || "",
    sortOrder: (count?.c || 0) + 1,
    isActive: isActive !== false,
  }).returning();
  res.status(201).json(banner);
});

router.put("/admin/featured/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, description, image, link, isActive, sortOrder } = req.body;
  const [banner] = await db.update(featuredBannersTable).set({
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(image !== undefined && { image }),
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

router.get("/admin/groups", async (_req, res): Promise<void> => {
  const groups = await db.select().from(groupsTable).orderBy(desc(groupsTable.createdAt));
  const result = await Promise.all(groups.map(async (g) => {
    const all = await db
      .select({
        platform: subscriptionsTable.applePlatform,
        deviceType: subscriptionsTable.deviceType,
        appleStatus: subscriptionsTable.appleStatus,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.groupName, g.certName));

    const iosCount = all.filter(d => d.platform === "IOS").length;
    const macCount = all.filter(d => d.platform === "MAC").length;
    const ipadCount = all.filter(d => d.platform === "IPAD_OS").length;
    const pendingCount = all.filter(d => d.appleStatus === "PROCESSING").length;
    const activeCount = all.filter(d => d.appleStatus === "ENABLED").length;

    return {
      ...g,
      privateKey: g.privateKey ? "••••••••" : "",
      iosCount,
      macCount,
      ipadCount,
      pendingCount,
      activeCount,
      totalDevices: all.length,
    };
  }));
  res.json({ groups: result });
});

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

// Smart platform resolver: decides IOS / MAC / IPAD_OS based on current slot usage
router.post("/admin/groups/:id/resolve-platform", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { deviceType } = req.body; // "iPhone" | "iPad"
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Not found" }); return; }

  const all = await db
    .select({ platform: subscriptionsTable.applePlatform })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.groupName, group.certName));

  const iosCount = all.filter(d => d.platform === "IOS").length;
  const macCount = all.filter(d => d.platform === "MAC").length;
  const ipadCount = all.filter(d => d.platform === "IPAD_OS").length;

  let platform = "";
  let message = "";
  let canRegister = true;

  if (deviceType === "iPad") {
    if (ipadCount < 100) {
      platform = "IPAD_OS";
      message = `تسجيل آيباد كـ IPAD_OS (${ipadCount + 1}/100)`;
    } else {
      canRegister = false;
      message = "الشهادة ممتلئة للآيبادات (100/100). انتقل لشهادة جديدة.";
    }
  } else {
    // iPhone
    if (iosCount < 100) {
      platform = "IOS";
      message = `تسجيل آيفون كـ IOS (${iosCount + 1}/100)`;
    } else if (macCount < 100) {
      platform = "MAC";
      message = `الـ IOS امتلأت (100/100). التحويل التلقائي لـ MAC bypass (${macCount + 1}/100) 🔀`;
    } else {
      canRegister = false;
      message = "الشهادة ممتلئة للآيفونات (200/200). انتقل لشهادة جديدة.";
    }
  }

  res.json({ platform, message, canRegister, iosCount, macCount, ipadCount });
});

// Update device apple status (PROCESSING → ENABLED)
router.patch("/admin/groups/device/:subId/status", async (req, res): Promise<void> => {
  const subId = Number(req.params.subId);
  const { appleStatus, applePlatform } = req.body;
  const updateData: Record<string, string> = {};
  if (appleStatus) updateData.appleStatus = appleStatus;
  if (applePlatform) updateData.applePlatform = applePlatform;
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
