import { Router, type IRouter } from "express";
import { db, categoriesTable, appsTable } from "@workspace/db";
import { sql, eq, count } from "drizzle-orm";
import { ListCategoriesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      nameAr: categoriesTable.nameAr,
      icon: categoriesTable.icon,
      bannerImage: categoriesTable.bannerImage,
      appCount: count(appsTable.id),
    })
    .from(categoriesTable)
    .leftJoin(appsTable, eq(categoriesTable.id, appsTable.categoryId))
    .groupBy(categoriesTable.id)
    .orderBy(categoriesTable.id);

  res.json(ListCategoriesResponse.parse({ categories: categories.map(c => ({ ...c, appCount: Number(c.appCount) })) }));
});

export default router;
