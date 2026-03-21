import { Router, type IRouter } from "express";
import { db, categoriesTable, appsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { ListCategoriesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      nameAr: categoriesTable.nameAr,
      icon: categoriesTable.icon,
      appCount: sql<number>`(SELECT count(*) FROM apps WHERE apps.category_id = ${categoriesTable.id})::int`,
    })
    .from(categoriesTable);

  res.json(ListCategoriesResponse.parse({ categories }));
});

export default router;
