import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, plansTable, subscriptionsTable, groupsTable } from "@workspace/db";
import {
  ListPlansResponse,
  ActivateSubscriptionBody,
  ActivateSubscriptionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Rate limiters ────────────────────────────────────────────────────────────
const activateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، حاول بعد قليل" },
});

const subscriberProfileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، حاول بعد قليل" },
});

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

router.post("/subscriptions/activate", activateLimiter, async (req, res): Promise<void> => {
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

  // Only bind UDID on first-time activation (never overwrite existing UDID)
  if (parsed.data.udid && !sub.udid) {
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

// ─── PUBLIC SUBSCRIBER PROFILE — safe public fields only ─────────────────────
// IMPORTANT: Never expose UDID, phone, email, groupName, or internal IDs here.
// This endpoint is public and accessible by code (10-char). Only show
// what the subscriber themselves would see on their profile card.
router.get("/subscriber/:code", subscriberProfileLimiter, async (req, res): Promise<void> => {
  const rawCode = req.params.code;
  // Validate code format: alphanumeric only, 6-20 chars
  if (!rawCode || !/^[A-Za-z0-9]{6,20}$/.test(rawCode)) {
    res.status(400).json({ error: "كود غير صالح" });
    return;
  }
  const code = rawCode.toUpperCase();

  const [sub] = await db
    .select({
      code: subscriptionsTable.code,
      subscriberName: subscriptionsTable.subscriberName,
      deviceType: subscriptionsTable.deviceType,
      planId: subscriptionsTable.planId,
      isActive: subscriptionsTable.isActive,
      activatedAt: subscriptionsTable.activatedAt,
      expiresAt: subscriptionsTable.expiresAt,
      createdAt: subscriptionsTable.createdAt,
    })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.code, code))
    .limit(1);

  if (!sub) { res.status(404).json({ error: "غير موجود" }); return; }

  const [plan] = sub.planId
    ? await db.select({ name: plansTable.name, nameAr: plansTable.nameAr })
        .from(plansTable).where(eq(plansTable.id, sub.planId)).limit(1)
    : [null];

  res.json({
    subscriber: {
      code: sub.code,
      subscriberName: sub.subscriberName,
      deviceType: sub.deviceType,
      isActive: sub.isActive,
      activatedAt: sub.activatedAt,
      expiresAt: sub.expiresAt,
      createdAt: sub.createdAt,
      planName: plan?.name || null,
      planNameAr: plan?.nameAr || null,
    },
  });
});

export default router;
