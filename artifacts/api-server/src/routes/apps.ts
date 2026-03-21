import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ilike } from "drizzle-orm";
import { db, appsTable, categoriesTable } from "@workspace/db";
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
  const offset = (page - 1) * limit;

  const conditions = [eq(appsTable.isHidden, false)];
  if (categoryId) conditions.push(eq(appsTable.categoryId, categoryId));
  if (section === "most_downloaded") {
    // no extra filter, sort by downloads
  } else if (section === "trending") {
    conditions.push(eq(appsTable.isHot, true));
  } else if (section === "latest") {
    conditions.push(sql`${appsTable.createdAt} > NOW() - INTERVAL '60 days'`);
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
    ? desc(appsTable.downloads)
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
      apps: apps.map((a) => ({ ...a, categoryName: a.categoryName ?? "Unknown" })),
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
      apps: apps.map((a) => ({ ...a, categoryName: a.categoryName ?? "Unknown" })),
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
      apps: apps.map((a) => ({ ...a, categoryName: a.categoryName ?? "Unknown" })),
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

  res.json(GetAppResponse.parse({ ...app, categoryName: app.categoryName ?? "Unknown" }));
});

export default router;
