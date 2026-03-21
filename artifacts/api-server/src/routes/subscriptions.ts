import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, plansTable, subscriptionsTable } from "@workspace/db";
import {
  ListPlansResponse,
  ActivateSubscriptionBody,
  ActivateSubscriptionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/subscriptions/plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(plansTable);
  res.json(
    ListPlansResponse.parse({
      plans: plans.map((p) => ({
        ...p,
        price: Number(p.price),
        excludedFeatures: p.excludedFeatures ?? [],
      })),
    })
  );
});

router.post("/subscriptions/activate", async (req, res): Promise<void> => {
  const parsed = ActivateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.code, parsed.data.code));

  if (!sub) {
    res.status(400).json(
      ActivateSubscriptionResponse.parse({
        success: false,
        message: "كود التفعيل غير صحيح",
      })
    );
    return;
  }

  if (sub.isActive === "false") {
    res.status(400).json(
      ActivateSubscriptionResponse.parse({
        success: false,
        message: "الاشتراك منتهي الصلاحية",
      })
    );
    return;
  }

  if (parsed.data.udid) {
    await db
      .update(subscriptionsTable)
      .set({ udid: parsed.data.udid, activatedAt: new Date() })
      .where(eq(subscriptionsTable.id, sub.id));
  }

  res.json(
    ActivateSubscriptionResponse.parse({
      success: true,
      message: "تم تفعيل الاشتراك بنجاح",
      expiresAt: sub.expiresAt,
    })
  );
});

export default router;
