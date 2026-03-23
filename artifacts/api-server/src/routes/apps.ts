import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ilike, inArray } from "drizzle-orm";
import { db, appsTable, categoriesTable, settingsTable, featuredBannersTable, appPlansTable, subscriptionsTable } from "@workspace/db";
import {
  ListAppsQueryParams,
  ListAppsResponse,
  ListFeaturedAppsResponse,
  ListHotAppsResponse,
  GetAppParams,
  GetAppResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

  // Resolve subscriber's planId if code provided
  let subscriberPlanId: number | null = null;
  if (code) {
    const [sub] = await db
      .select({ planId: subscriptionsTable.planId })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.code, code))
      .limit(1);
    if (sub) subscriberPlanId = sub.planId;
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
    // no extra filter, sort by downloads desc
  } else if (section === "trending") {
    // show apps ordered by downloads, prefer isHot if any, otherwise all
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
      icon: appsTable.icon,
      iconUrl: appsTable.icon,
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
      apps: apps.map((a) => ({ ...a, categoryName: a.categoryName ?? "Unknown", categoryNameAr: a.categoryNameAr ?? undefined })),
      total: count,
      page,
      limit,
    })
  );
});

router.get("/apps/featured", async (_req, res): Promise<void> => {
  const apps = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      icon: appsTable.icon,
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
      apps: apps.map((a) => ({ ...a, categoryName: a.categoryName ?? "Unknown", categoryNameAr: a.categoryNameAr ?? undefined })),
      total: apps.length,
    })
  );
});

router.get("/apps/hot", async (_req, res): Promise<void> => {
  const apps = await db
    .select({
      id: appsTable.id,
      name: appsTable.name,
      description: appsTable.description,
      icon: appsTable.icon,
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
      apps: apps.map((a) => ({ ...a, categoryName: a.categoryName ?? "Unknown", categoryNameAr: a.categoryNameAr ?? undefined })),
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
      icon: appsTable.icon,
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

  res.json(GetAppResponse.parse({ ...app, categoryName: app.categoryName ?? "Unknown", categoryNameAr: app.categoryNameAr ?? undefined }));
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

export default router;
