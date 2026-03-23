import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, plansTable, subscriptionsTable, groupsTable, balanceTransactionsTable } from "@workspace/db";
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

// ─── GET /api/subscriber/me?code=XXX (public — full subscriber info) ─────────
// NOTE: Must be placed before /subscriber/:code to avoid route collision.
router.get("/subscriber/me", async (req, res): Promise<void> => {
  const code = ((req.query.code as string) || "").trim();
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  try {
    const [sub] = await db
      .select({
        id: subscriptionsTable.id,
        subscriberName: subscriptionsTable.subscriberName,
        phone: subscriptionsTable.phone,
        email: subscriptionsTable.email,
        udid: subscriptionsTable.udid,
        deviceType: subscriptionsTable.deviceType,
        groupName: subscriptionsTable.groupName,
        planId: subscriptionsTable.planId,
        isActive: subscriptionsTable.isActive,
        balance: subscriptionsTable.balance,
        activatedAt: subscriptionsTable.activatedAt,
        expiresAt: subscriptionsTable.expiresAt,
        createdAt: subscriptionsTable.createdAt,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.code, code))
      .limit(1);
    if (!sub) { res.status(404).json({ error: "not found" }); return; }

    // Fetch plan info
    const [plan] = sub.planId
      ? await db.select({ name: plansTable.name, nameAr: plansTable.nameAr, price: plansTable.price, duration: plansTable.duration })
          .from(plansTable).where(eq(plansTable.id, sub.planId)).limit(1)
      : [null];

    const { id, ...subWithoutId } = sub;
    res.json({ ...subWithoutId, planName: plan?.name ?? null, planNameAr: plan?.nameAr ?? null, planPrice: plan?.price ?? null, planDuration: plan?.duration ?? null });
  } catch (err) {
    console.error("[subscriber/me] error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// ─── GET /api/subscriber/balance?code=XXX (public) ───────────────────────────
router.get("/subscriber/balance", async (req, res): Promise<void> => {
  const code = ((req.query.code as string) || "").trim();
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  try {
    const [sub] = await db.select({ id: subscriptionsTable.id, balance: subscriptionsTable.balance })
      .from(subscriptionsTable).where(eq(subscriptionsTable.code, code)).limit(1);
    if (!sub) { res.status(404).json({ error: "not found" }); return; }
    const txs = await db.select({
      id: balanceTransactionsTable.id,
      type: balanceTransactionsTable.type,
      amount: balanceTransactionsTable.amount,
      balanceAfter: balanceTransactionsTable.balanceAfter,
      note: balanceTransactionsTable.note,
      createdAt: balanceTransactionsTable.createdAt,
    }).from(balanceTransactionsTable)
      .where(eq(balanceTransactionsTable.subscriptionId, sub.id))
      .orderBy(desc(balanceTransactionsTable.createdAt))
      .limit(10);
    res.json({ balance: sub.balance, transactions: txs });
  } catch {
    res.status(500).json({ error: "server error" });
  }
});

// ─── PUBLIC SUBSCRIBER PROFILE — safe public fields only ─────────────────────
// IMPORTANT: Never expose UDID, phone, email, groupName, or internal IDs here.
// This endpoint is public and accessible by code (10-char). Only show
// what the subscriber themselves would see on their profile card.
router.get("/subscriber/:code", subscriberProfileLimiter, async (req, res): Promise<void> => {
  const rawCode = req.params.code;
  // Validate code format: alphanumeric + hyphens/underscores, 4-30 chars
  if (!rawCode || !/^[A-Za-z0-9_-]{4,30}$/.test(rawCode)) {
    res.status(400).json({ error: "كود غير صالح" });
    return;
  }
  const code = rawCode.toUpperCase();

  const [sub] = await db
    .select({
      id: subscriptionsTable.id,
      code: subscriptionsTable.code,
      subscriberName: subscriptionsTable.subscriberName,
      phone: subscriptionsTable.phone,
      email: subscriptionsTable.email,
      udid: subscriptionsTable.udid,
      deviceType: subscriptionsTable.deviceType,
      groupName: subscriptionsTable.groupName,
      planId: subscriptionsTable.planId,
      isActive: subscriptionsTable.isActive,
      balance: subscriptionsTable.balance,
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

  // Fetch group download link if groupName is set
  let storeDownloadLink: string | null = null;
  if (sub.groupName) {
    const [grp] = await db
      .select({ storeIpaPath: groupsTable.storeIpaPath, certName: groupsTable.certName })
      .from(groupsTable)
      .where(eq(groupsTable.certName, sub.groupName))
      .limit(1);
    if (grp?.storeIpaPath) {
      // Build itms-services download link — same logic as activate.ts
      const proto = (req as any).headers["x-forwarded-proto"] || req.protocol || "https";
      const host = (req as any).headers["x-forwarded-host"] || req.get("host") || "";
      const base = `${proto}://${host}`;
      storeDownloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/api/groups/${encodeURIComponent(grp.certName)}/manifest.plist`)}`;
    }
  }

  res.json({
    subscriber: {
      id: sub.id,
      code: sub.code,
      subscriberName: sub.subscriberName,
      phone: sub.phone,
      email: sub.email,
      udid: sub.udid,
      deviceType: sub.deviceType,
      groupName: sub.groupName,
      isActive: sub.isActive,
      balance: sub.balance ?? 0,
      activatedAt: sub.activatedAt,
      expiresAt: sub.expiresAt,
      createdAt: sub.createdAt,
      planName: plan?.name || null,
      planNameAr: plan?.nameAr || null,
      storeDownloadLink,
    },
  });
});

// ── Save / update push token for a subscriber ────────────────────────────────
router.post("/subscriber/push-token", async (req, res): Promise<void> => {
  const { code, pushToken } = req.body as { code?: string; pushToken?: string };

  if (!code || !pushToken) {
    res.status(400).json({ error: "code and pushToken are required" });
    return;
  }

  const [sub] = await db
    .select({ id: subscriptionsTable.id })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.code, code));

  if (!sub) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }

  await db
    .update(subscriptionsTable)
    .set({ pushToken })
    .where(eq(subscriptionsTable.id, sub.id));

  res.json({ ok: true });
});

export default router;
