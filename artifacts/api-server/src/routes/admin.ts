import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, appsTable, categoriesTable, plansTable, subscriptionsTable, featuredBannersTable, settingsTable } from "@workspace/db";
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

router.get("/admin/apps", async (req, res): Promise<void> => {
  const query = AdminListAppsQueryParams.safeParse(req.query);
  const page = query.success ? query.data.page ?? 1 : 1;
  const limit = query.success ? query.data.limit ?? 50 : 50;
  const offset = (page - 1) * limit;

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
      size: appsTable.size,
      downloads: appsTable.downloads,
      isFeatured: appsTable.isFeatured,
      isHot: appsTable.isHot,
      createdAt: appsTable.createdAt,
    })
    .from(appsTable)
    .leftJoin(categoriesTable, eq(appsTable.categoryId, categoriesTable.id))
    .orderBy(desc(appsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(appsTable);

  res.json(
    AdminListAppsResponse.parse({
      apps: apps.map((a) => ({ ...a, categoryName: a.categoryName ?? "Unknown" })),
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

  res.status(201).json({
    ...app,
    categoryName: category?.name ?? "Unknown",
  });
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

router.get("/admin/featured", async (_req, res): Promise<void> => {
  const banners = await db.select().from(featuredBannersTable).orderBy(featuredBannersTable.sortOrder);
  res.json({ banners });
});

router.post("/admin/featured", async (req, res): Promise<void> => {
  const { title, description, image, link } = req.body;
  const [count] = await db.select({ c: sql<number>`count(*)::int` }).from(featuredBannersTable);
  const [banner] = await db.insert(featuredBannersTable).values({
    title: title || "",
    description: description || "",
    image: image || "",
    link: link || "",
    sortOrder: (count?.c || 0) + 1,
  }).returning();
  res.status(201).json(banner);
});

router.put("/admin/featured/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, description, image, link } = req.body;
  const [banner] = await db.update(featuredBannersTable).set({
    title, description, image, link,
  }).where(eq(featuredBannersTable.id, id)).returning();
  if (!banner) { res.status(404).json({ error: "Not found" }); return; }
  res.json(banner);
});

router.delete("/admin/featured/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(featuredBannersTable).where(eq(featuredBannersTable.id, id));
  res.sendStatus(204);
});

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
