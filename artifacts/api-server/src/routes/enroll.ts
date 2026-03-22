import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, enrollmentRequestsTable, plansTable } from "@workspace/db";
import { signMobileconfig } from "../sign-profile.js";

const router: IRouter = Router();

// ─── In-memory token → UDID store (TTL: 5 min) ───────────────────────────────
const udidTokenStore = new Map<string, { udid: string; createdAt: number }>();
const TOKEN_TTL_MS = 5 * 60 * 1000;

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [token, val] of udidTokenStore) {
    if (now - val.createdAt > TOKEN_TTL_MS) udidTokenStore.delete(token);
  }
}
setInterval(cleanExpiredTokens, 60_000);

function getBaseUrl(req: import("express").Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string) || "";
  return `${proto}://${host}`;
}

function requireAdmin(req: import("express").Request, res: import("express").Response): boolean {
  const token = req.headers["x-admin-token"] as string;
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
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

  // Two modes:
  // 1. "app" source = activation (تفعيل اشتراك) — from Mismari+ app onboarding
  // 2. "web" source = enrollment request (طلب اشتراك) — from website
  const isActivation = source === "app";

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
      <string>DEVICE_NAME</string>
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

      // Save UDID to token store (for app polling)
      if (token) {
        udidTokenStore.set(token, { udid, createdAt: Date.now() });
      }

      // For web source, save UDID as a pending enrollment request
      if (source === "web") {
        await db.insert(enrollmentRequestsTable).values({
          udid,
          deviceName,
          status: "pending",
        }).onConflictDoNothing();
      }

      // Return a Web Clip profile (non-managed) pointing to the enrollment form.
      // com.apple.webClip (not .managed) works on non-supervised devices.
      // The UDID is already saved above; the website polls via token.
      const profileUuid = crypto.randomUUID();
      const webClipUuid = crypto.randomUUID();
      const enrollUrl = `${base}/enroll?udid=${encodeURIComponent(udid)}`;

      const responseProfile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.webClip</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>com.mismari.webclip.${webClipUuid}</string>
      <key>PayloadUUID</key>
      <string>${webClipUuid}</string>
      <key>PayloadDisplayName</key>
      <string>مسماري — أكمل طلبك</string>
      <key>Label</key>
      <string>مسماري+</string>
      <key>URL</key>
      <string>${enrollUrl}</string>
      <key>FullScreen</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>اكمل تسجيل اشتراكك في مسماري</string>
  <key>PayloadDisplayName</key>
  <string>مسماري — تسجيل الاشتراك</string>
  <key>PayloadIdentifier</key>
  <string>com.mismari.enrolled.${profileUuid}</string>
  <key>PayloadOrganization</key>
  <string>Mismari</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

      const { buf: signedBuf, signed: didSign } = signMobileconfig(responseProfile);
      res.setHeader("Content-Type", "application/x-apple-aspen-config");
      if (didSign) {
        console.info("[callback] Returning SIGNED Web Clip profile for UDID:", udid);
      } else {
        console.warn("[callback] Returning UNSIGNED profile — set SIGN_CERT_PEM + SIGN_KEY_PEM to fix iOS 16+ rejection");
      }
      res.send(signedBuf);
    } catch (err) {
      console.error("Profile callback error:", err);
      res.status(500).send("Server error");
    }
  }
);

// ─── Poll for UDID by token (app polls this after profile install) ────────────
router.get("/profile/udid-check", (req, res): void => {
  // Must disable all caching — stale 304s prevent the app from detecting UDID
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const token = (req.query.token as string) || "";
  if (!token) { res.status(400).json({ error: "token required" }); return; }

  const entry = udidTokenStore.get(token);
  if (entry && Date.now() - entry.createdAt <= TOKEN_TTL_MS) {
    udidTokenStore.delete(token); // consume it
    res.json({ found: true, udid: entry.udid });
  } else {
    res.json({ found: false });
  }
});

// ─── Check if UDID already subscribed ────────────────────────────────────────
router.get("/enroll/check", async (req, res): Promise<void> => {
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
router.post("/enroll/request", async (req, res): Promise<void> => {
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
      .select({ id: enrollmentRequestsTable.id })
      .from(enrollmentRequestsTable)
      .where(eq(enrollmentRequestsTable.udid, udid))
      .limit(1);

    if (existing) {
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
    }).returning();

    // Update enrollment request status to approved
    await db
      .update(enrollmentRequestsTable)
      .set({ status: "approved" })
      .where(eq(enrollmentRequestsTable.id, id));

    res.status(201).json({ success: true, subscription: sub });
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
