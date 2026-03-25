import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { db, subscriptionsTable, enrollmentRequestsTable, plansTable, udidTokensTable } from "@workspace/db";
import { signMobileconfig } from "../sign-profile.js";
import { registerDeviceWithApple } from "../apple-connect.js";
import { JWT_SECRET } from "../middleware/adminAuth.js";

const router: IRouter = Router();

const TOKEN_TTL_MS = 10 * 60 * 1000;

// ─── Safe base URL resolution ─────────────────────────────────────────────────
function getBaseUrl(req: import("express").Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return "https://app.mismari.com";
}

// ─── Rate limiters for public enroll endpoints ───────────────────────────────
const enrollRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، حاول بعد قليل" },
});

const enrollCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، حاول بعد قليل" },
});

// ─── Real JWT-verified admin guard ───────────────────────────────────────────
function requireAdmin(req: import("express").Request, res: import("express").Response): boolean {
  const token =
    (req.headers["x-admin-token"] as string) ||
    (req.headers["authorization"] as string)?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "غير مصرّح — يرجى تسجيل الدخول" });
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    (req as any).admin = payload;
    return true;
  } catch {
    res.status(401).json({ error: "انتهت صلاحية الجلسة أو التوكن غير صالح" });
    return false;
  }
}

function randomCode(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── UDID enrollment profile ─────────────────────────────────────────────────
router.get("/profile/enroll", (req, res): void => {
  const base = getBaseUrl(req);
  const source = (req.query.source as string) || "web";
  const plan = (req.query.plan as string) || "";
  const token = (req.query.token as string) || "";
  // Use &amp; in XML — raw & is invalid XML and causes "Invalid Profile"
  const callbackParams = `source=${encodeURIComponent(source)}${token ? `&amp;token=${encodeURIComponent(token)}` : ""}`;
  const callbackUrl = `${base}/api/profile/callback?${callbackParams}`;

  // Three modes:
  // 1. "app" / "activate" = subscription activation — from app or website activate page
  // 2. "web" = enrollment request (طلب اشتراك) — from enroll page
  const isActivation = source === "app" || source === "activate";

  const displayName = "Mismari App";
  const subtitle = isActivation
    ? "تفعيل إشتراك"
    : plan ? `باقة ${plan}` : "طلب إشتراك";
  const description = isActivation
    ? "يتيح لك هذا الملف بتفعيل اشتراكك للحصول على تطبيق مسماري"
    : "يتيح لك هذا الملف بتسجيل طلب اشتراك للحصول على تطبيق مسماري";

  const uuid = crypto.randomUUID();

  const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <dict>
    <key>URL</key>
    <string>${callbackUrl}</string>
    <key>DeviceAttributes</key>
    <array>
      <string>UDID</string>
      <string>IMEI</string>
      <string>ICCID</string>
      <string>VERSION</string>
      <string>PRODUCT</string>
    </array>
  </dict>
  <key>PayloadOrganization</key>
  <string>${subtitle}</string>
  <key>PayloadDisplayName</key>
  <string>${displayName}</string>
  <key>PayloadDescription</key>
  <string>${description}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadUUID</key>
  <string>${uuid}</string>
  <key>PayloadIdentifier</key>
  <string>com.mismari.udid-service.${uuid}</string>
  <key>PayloadType</key>
  <string>Profile Service</string>
</dict>
</plist>`;

  const { buf, signed } = signMobileconfig(profile);
  res.setHeader("Content-Type", "application/x-apple-aspen-config");
  res.setHeader("Content-Disposition", 'attachment; filename="mismari-enroll.mobileconfig"');
  if (signed) {
    console.info("[enroll] Serving SIGNED profile for UDID enrollment");
  }
  res.send(buf);
});

// ─── Profile callback: extract UDID ──────────────────────────────────────────
router.post(
  "/profile/callback",
  (req, _res, next) => {
    let data = Buffer.alloc(0);
    req.on("data", (chunk: Buffer) => { data = Buffer.concat([data, chunk]); });
    req.on("end", () => { (req as any).rawBody = data; next(); });
  },
  async (req, res): Promise<void> => {
    try {
      const bodyStr = ((req as any).rawBody as Buffer | undefined)?.toString("utf8") || "";
      // Accept any alphanumeric UDID format (old hex, new alphanumeric)
      const udidMatch = bodyStr.match(/<key>UDID<\/key>\s*<string>([A-Za-z0-9-]+)<\/string>/);
      const udid = udidMatch?.[1]?.trim();
      const deviceNameMatch = bodyStr.match(/<key>DEVICE_NAME<\/key>\s*<string>([^<]+)<\/string>/);
      const deviceName = deviceNameMatch?.[1]?.trim() || null;

      if (!udid) {
        console.error("UDID extraction failed. Body:", bodyStr.substring(0, 500));
        res.status(400).send("Could not extract UDID from device response");
        return;
      }

      const source = (req.query.source as string) || "web";
      const token = (req.query.token as string) || "";
      const base = getBaseUrl(req);

      console.info(`[callback] UDID: ${udid}, device: ${deviceName || "unknown"}, source: ${source}`);

      if (token) {
        try {
          await db.insert(udidTokensTable).values({ token, udid }).onConflictDoNothing();
        } catch (e) {
          console.error("[callback] DB insert udid_tokens failed:", e);
        }
      }

      // For web source, save UDID as a pending enrollment request
      if (source === "web") {
        await db.insert(enrollmentRequestsTable).values({
          udid,
          deviceName,
          status: "pending",
        }).onConflictDoNothing();
      }

      console.info("[callback] Returning redirect to app for UDID:", udid);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<script>
  window.location.href = "mismari://onboarding?udid=${encodeURIComponent(udid)}";
  setTimeout(function() { try { window.close(); } catch(e) {} }, 1500);
</script>
</head><body></body></html>`);
    } catch (err) {
      console.error("Profile callback error:", err);
      res.status(500).send("Server error");
    }
  }
);

// ─── Poll for UDID by token (app polls this after profile install) ────────────
router.get("/profile/udid-check", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const token = (req.query.token as string) || "";
  if (!token) { res.status(400).json({ error: "token required" }); return; }

  console.info(`[udid-check] Polling token=${token.substring(0, 8)}...`);

  try {
    const [entry] = await db.select().from(udidTokensTable).where(eq(udidTokensTable.token, token)).limit(1);
    if (entry && (Date.now() - new Date(entry.createdAt).getTime()) <= TOKEN_TTL_MS) {
      console.info(`[udid-check] FOUND udid=${entry.udid} for token=${token.substring(0, 8)}...`);
      res.json({ found: true, udid: entry.udid });
    } else {
      res.json({ found: false });
    }
  } catch (e) {
    console.error("[udid-check] DB query failed:", e);
    res.json({ found: false });
  }
});

// ─── Check if UDID already subscribed ────────────────────────────────────────
router.get("/enroll/check", enrollCheckLimiter, async (req, res): Promise<void> => {
  const { udid } = req.query as { udid?: string };
  if (!udid) { res.status(400).json({ error: "udid required" }); return; }

  try {
    const [sub] = await db
      .select({
        id: subscriptionsTable.id,
        code: subscriptionsTable.code,
        subscriberName: subscriptionsTable.subscriberName,
        isActive: subscriptionsTable.isActive,
        expiresAt: subscriptionsTable.expiresAt,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.udid, udid))
      .limit(1);

    if (sub) {
      res.json({ found: true, subscriber: sub });
    } else {
      res.json({ found: false });
    }
  } catch (err) {
    console.error("Enroll check error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /enroll/request — submit enrollment request ────────────────────────
router.post("/enroll/request", enrollRequestLimiter, async (req, res): Promise<void> => {
  const { name, phone, email, udid, deviceType, planId, notes } = req.body as {
    name?: string;
    phone?: string;
    email?: string;
    udid?: string;
    deviceType?: string;
    planId?: number | string;
    notes?: string;
  };

  if (!udid) { res.status(400).json({ error: "udid required" }); return; }

  try {
    const [existing] = await db
      .select({ id: enrollmentRequestsTable.id, status: enrollmentRequestsTable.status })
      .from(enrollmentRequestsTable)
      .where(eq(enrollmentRequestsTable.udid, udid))
      .orderBy(enrollmentRequestsTable.createdAt)
      .limit(1);

    if (existing) {
      // Update name/phone/email if missing (UDID captured before form was filled)
      await db
        .update(enrollmentRequestsTable)
        .set({
          name: name?.trim() || undefined,
          phone: phone?.trim() || undefined,
          email: email?.trim() || undefined,
          deviceType: deviceType?.trim() || undefined,
          planId: planId ? Number(planId) : undefined,
          notes: notes?.trim() || undefined,
        })
        .where(eq(enrollmentRequestsTable.id, existing.id));

      res.json({ success: true, message: "request_exists" });
      return;
    }

    await db.insert(enrollmentRequestsTable).values({
      name: name?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      udid: udid.trim(),
      deviceType: deviceType?.trim() || null,
      planId: planId ? Number(planId) : null,
      notes: notes?.trim() || null,
      status: "pending",
    });

    res.json({ success: true, message: "submitted" });
  } catch (err) {
    console.error("Enroll request error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /admin/enroll-requests ──────────────────────────────────────────────
router.get("/admin/enroll-requests", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await db
      .select({
        id: enrollmentRequestsTable.id,
        name: enrollmentRequestsTable.name,
        phone: enrollmentRequestsTable.phone,
        email: enrollmentRequestsTable.email,
        udid: enrollmentRequestsTable.udid,
        deviceType: enrollmentRequestsTable.deviceType,
        planId: enrollmentRequestsTable.planId,
        planName: plansTable.name,
        planNameAr: plansTable.nameAr,
        notes: enrollmentRequestsTable.notes,
        status: enrollmentRequestsTable.status,
        createdAt: enrollmentRequestsTable.createdAt,
      })
      .from(enrollmentRequestsTable)
      .leftJoin(plansTable, eq(enrollmentRequestsTable.planId, plansTable.id))
      .orderBy(enrollmentRequestsTable.createdAt);

    res.json({ requests: rows });
  } catch (err) {
    console.error("Admin enroll-requests error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PUT /admin/enroll-requests/:id — update status ──────────────────────────
router.put("/admin/enroll-requests/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id, 10);
  const { status } = req.body as { status?: string };

  try {
    await db
      .update(enrollmentRequestsTable)
      .set({ status: status || "pending" })
      .where(eq(enrollmentRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Admin enroll-requests PUT error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /admin/enroll-requests/:id/approve ─────────────────────────────────
// Approves enrollment request + creates subscriber in subscriptions table
router.post("/admin/enroll-requests/:id/approve", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id, 10);
  const { groupName, planId: overridePlanId } = req.body as { groupName?: string; planId?: number | string };

  if (!groupName?.trim()) {
    res.status(400).json({ error: "groupName مطلوب" });
    return;
  }

  try {
    // Get the enrollment request
    const [row] = await db
      .select()
      .from(enrollmentRequestsTable)
      .where(eq(enrollmentRequestsTable.id, id))
      .limit(1);

    if (!row) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
    if (row.status === "approved") { res.status(409).json({ error: "تم قبول هذا الطلب مسبقاً" }); return; }

    // Determine planId
    const finalPlanId = overridePlanId ? Number(overridePlanId) : (row.planId || null);
    if (!finalPlanId) {
      res.status(400).json({ error: "يجب تحديد الباقة" });
      return;
    }

    // Generate unique code
    let code = randomCode(10);
    for (let i = 0; i < 5; i++) {
      const existing = await db.select({ id: subscriptionsTable.id }).from(subscriptionsTable).where(eq(subscriptionsTable.code, code)).limit(1);
      if (existing.length === 0) break;
      code = randomCode(10);
    }

    // ── Determine Apple platform via smart routing ──────────────────────────
    let applePlatform = "IOS";
    let appleStatus = "PROCESSING";
    let appleDeviceId: string | null = null;
    let appleMessage = "";

    if (row.udid && row.udid.length > 10) {
      const deviceTypeForApple = (row.deviceType === "iPad" ? "iPad" : "iPhone") as "iPhone" | "iPad";
      const appleResult = await registerDeviceWithApple({
        certName: groupName.trim(),
        udid: row.udid,
        deviceType: deviceTypeForApple,
        deviceName: row.name ? `Mismari_${row.name.replace(/\s+/g, "_").substring(0, 20)}` : undefined,
      });
      applePlatform = appleResult.platform;
      appleStatus = appleResult.appleStatus;
      appleDeviceId = appleResult.appleDeviceId || null;
      appleMessage = appleResult.message;
      console.log(`[approve] Apple registration: ${appleMessage}`);
    }

    // Create subscription
    const [sub] = await db.insert(subscriptionsTable).values({
      code,
      udid: row.udid || null,
      phone: row.phone || null,
      email: row.email || null,
      deviceType: row.deviceType || null,
      subscriberName: row.name || null,
      groupName: groupName.trim(),
      planId: finalPlanId,
      sourceType: "enrollment_request",
      isActive: "true",
      activatedAt: new Date(),
      applePlatform,
      appleStatus,
      appleDeviceId,
    }).returning();

    // Update enrollment request status to approved
    await db
      .update(enrollmentRequestsTable)
      .set({ status: "approved" })
      .where(eq(enrollmentRequestsTable.id, id));

    res.status(201).json({ success: true, subscription: sub, appleMessage });
  } catch (err) {
    console.error("Admin enroll approve error:", err);
    res.status(500).json({ error: "حدث خطأ أثناء الموافقة" });
  }
});

// ─── DELETE /admin/enroll-requests/:id ───────────────────────────────────────
router.delete("/admin/enroll-requests/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const id = parseInt(req.params.id, 10);
  try {
    await db.delete(enrollmentRequestsTable).where(eq(enrollmentRequestsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error("Admin enroll-requests DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
