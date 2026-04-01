import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { db, subscriptionsTable, groupsTable, plansTable } from "@workspace/db";
import { registerDeviceWithApple } from "../apple-connect";
import { adminAuth } from "../middleware/adminAuth";
import { signIpa, saveToken, randomHex, resolveLocalPath, downloadToTemp, SIGNED_DIR, TOKEN_TTL_MS, type TokenMeta } from "../lib/signer";

const router: IRouter = Router();

/** Escape XML special characters to prevent XML/plist injection */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const DYLIB_DIR        = path.join(process.cwd(), "uploads", "dylibs");
const STORE_DYLIB_PATH = path.join(DYLIB_DIR, "mismari-store.dylib");

async function ensureStoreDylibLocal(): Promise<void> {
  if (fs.existsSync(STORE_DYLIB_PATH)) return;
  const dlDomain = process.env.R2_DL_DOMAIN || "https://dl.mismari.com";
  const r2Url = `${dlDomain}/dylibs/mismari-store.dylib`;
  try {
    fs.mkdirSync(DYLIB_DIR, { recursive: true });
    const { default: https } = await import("https");
    const { default: http } = await import("http");
    const tmpPath = STORE_DYLIB_PATH + ".tmp";
    await new Promise<void>((resolve, reject) => {
      const proto = r2Url.startsWith("https") ? https : http;
      const file = fs.createWriteStream(tmpPath);
      proto.get(r2Url, (res) => {
        if (res.statusCode !== 200) { file.close(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", reject);
    });
    fs.renameSync(tmpPath, STORE_DYLIB_PATH);
    console.log(`[activate] mismari-store.dylib downloaded from R2`);
  } catch (e: any) {
    console.warn(`[activate] Could not download mismari-store.dylib: ${e.message}`);
  }
}

function getStoreDylibPath(): string | null {
  return fs.existsSync(STORE_DYLIB_PATH) ? STORE_DYLIB_PATH : null;
}

// ─── Rate limiters ────────────────────────────────────────────────────────────
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، حاول بعد قليل" },
});

const completeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة جداً، حاول بعد قليل" },
});

// ─── Safe base URL resolution ─────────────────────────────────────────────────
// Prefer APP_BASE_URL env var (set this in production to avoid host-header injection).
// Falls back to reconstructing from request headers in dev.
function getBaseUrl(req: import("express").Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return "https://app.mismari.com";
}


// ─── Storage for store IPA uploads ────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads", "StoreIPA");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storeIpaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    cb(null, `store_${ts}_${file.originalname.replace(/\s+/g, "_")}`);
  },
});
const storeIpaUpload = multer({ storage: storeIpaStorage, limits: { fileSize: 500 * 1024 * 1024 } });

// ─── GET /activate/validate — check subscription code ─────────────────────────
// Returns group info + itms-services download link if code is valid
router.post("/activate/validate", validateLimiter, async (req, res): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code?.trim()) {
    res.status(400).json({ error: "الكود مطلوب" });
    return;
  }

  const [sub] = await db
    .select({
      id: subscriptionsTable.id,
      code: subscriptionsTable.code,
      groupName: subscriptionsTable.groupName,
      planId: subscriptionsTable.planId,
      planName: plansTable.name,
      planNameAr: plansTable.nameAr,
      isActive: subscriptionsTable.isActive,
      expiresAt: subscriptionsTable.expiresAt,
      subscriberName: subscriptionsTable.subscriberName,
      udid: subscriptionsTable.udid,
    })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.code, code.trim().toUpperCase()))
    .limit(1);

  if (!sub) {
    res.status(404).json({ valid: false, error: "كود الاشتراك غير صحيح" });
    return;
  }

  // If the code has a subscriber already registered but isActive is false → admin deactivated it
  const hasSubscriber = !!(sub.subscriberName && sub.udid);
  if (sub.isActive === "false" && hasSubscriber) {
    res.status(400).json({ valid: false, error: "هذا الاشتراك موقوف — تواصل مع الدعم" });
    return;
  }

  // A fresh pre-generated code (isActive: "false", no subscriber yet) is allowed through for activation
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    res.status(400).json({ valid: false, error: "انتهت صلاحية هذا الاشتراك" });
    return;
  }

  // If already has info registered
  if (hasSubscriber) {
    res.json({
      valid: true,
      alreadyRegistered: true,
      subscriberId: sub.id,
      code: sub.code,
      planName: sub.planNameAr || sub.planName,
      groupName: sub.groupName,
    });
    return;
  }

  // Get group info + IPA link (prefer ipaUrl over legacy storeIpaPath)
  let downloadLink: string | null = null;
  if (sub.groupName) {
    const [group] = await db
      .select({ storeIpaPath: groupsTable.storeIpaPath, ipaUrl: groupsTable.ipaUrl, bundleId: groupsTable.bundleId, certName: groupsTable.certName })
      .from(groupsTable)
      .where(eq(groupsTable.certName, sub.groupName))
      .limit(1);

    if (group && (group.ipaUrl || group.storeIpaPath)) {
      const base = getBaseUrl(req);
      downloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/api/groups/${encodeURIComponent(group.certName)}/manifest.plist`)}`;
    }
  }

  res.json({
    valid: true,
    alreadyRegistered: false,
    subscriptionId: sub.id,
    code: sub.code,
    planName: sub.planNameAr || sub.planName,
    groupName: sub.groupName,
    downloadLink,
    hasIpa: !!downloadLink,
  });
});

// ─── GET /d/:slug — public download page info ─────────────────────────────────
router.get("/d/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [group] = await db
    .select({
      id: groupsTable.id,
      certName: groupsTable.certName,
      bundleId: groupsTable.bundleId,
      ipaUrl: groupsTable.ipaUrl,
      storeIpaPath: groupsTable.storeIpaPath,
      downloadSlug: groupsTable.downloadSlug,
    })
    .from(groupsTable)
    .where(eq(groupsTable.downloadSlug, slug))
    .limit(1);

  if (!group) {
    res.status(404).json({ error: "رابط التحميل غير موجود" });
    return;
  }

  const effectiveIpaUrl = group.ipaUrl || group.storeIpaPath;
  if (!effectiveIpaUrl) {
    res.status(404).json({ error: "لم يتم إعداد رابط IPA لهذه المجموعة بعد" });
    return;
  }

  const base = getBaseUrl(req);
  const plistUrl = `${base}/api/groups/${encodeURIComponent(group.certName)}/manifest.plist`;
  const downloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(plistUrl)}`;

  res.json({
    certName: group.certName,
    hasIpa: true,
    plistUrl,
    downloadLink,
  });
});

// ─── GET /groups/:certName/manifest.plist — sign + serve manifest ────────────
router.get("/groups/:certName/manifest.plist", async (req, res): Promise<void> => {
  const { certName } = req.params;

  const [group] = await db
    .select({
      storeIpaPath: groupsTable.storeIpaPath,
      ipaUrl: groupsTable.ipaUrl,
      certName: groupsTable.certName,
      bundleId: groupsTable.bundleId,
      p12Data: groupsTable.p12Data,
      mobileprovisionData: groupsTable.mobileprovisionData,
      p12Password: groupsTable.p12Password,
    })
    .from(groupsTable)
    .where(eq(groupsTable.certName, decodeURIComponent(certName)))
    .limit(1);

  const effectiveIpaUrl = group?.ipaUrl || group?.storeIpaPath;
  if (!group || !effectiveIpaUrl) {
    res.status(404).send("Group not found or no IPA configured");
    return;
  }

  const base = getBaseUrl(req);
  const bundleId = group.bundleId || "com.mismari.app";

  // ── If group has signing credentials → sign the IPA and serve signed URL ──
  if (group.p12Data && group.mobileprovisionData) {
    try {
      // Resolve local path — prefer storeIpaPath (local) over ipaUrl (HTTP URL)
      let inputPath: string;
      let tempDownloaded = false;

      // Try storeIpaPath first (resolves to uploads/SignedStore/...)
      const storeLocal = group.storeIpaPath ? resolveLocalPath(group.storeIpaPath) : "";
      const ipaLocal = resolveLocalPath(effectiveIpaUrl);
      const localPath = (storeLocal && fs.existsSync(storeLocal)) ? storeLocal
                      : (fs.existsSync(ipaLocal) ? ipaLocal : "");

      if (localPath) {
        inputPath = localPath;
      } else {
        // Might be an external URL — download first
        const rawUrl = effectiveIpaUrl.startsWith("http")
          ? effectiveIpaUrl
          : `${base}${effectiveIpaUrl}`;
        inputPath = await downloadToTemp(rawUrl);
        tempDownloaded = true;
      }

      const token = randomHex(16);
      const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);
      // ✅ Inject mismari-store.dylib (JB bypass, safe mode, welcome msg, auto-update)
      // ⚠️ Never inject antirevoke.dylib here — crashes React Native / Hermes
      await ensureStoreDylibLocal();
      const storeDylib = getStoreDylibPath();
      await signIpa({
        p12Base64: group.p12Data,
        p12Password: group.p12Password || "",
        mpBase64: group.mobileprovisionData,
        inputPath,
        outputPath,
        bundleId,
        bundleName: "Mismari+",
        dylibPaths: storeDylib ? [storeDylib] : undefined,
      });

      if (tempDownloaded) {
        fs.rmSync(inputPath, { force: true });
      }

      const meta: TokenMeta = {
        appName: "Mismari+",
        appVersion: "1.0.0",
        bundleId,
        ipaPath: outputPath,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      };
      saveToken(token, meta);

      const ipaUrl = `${base}/api/sign/ipa/${token}.ipa`;
      const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${xmlEscape(ipaUrl)}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${xmlEscape(bundleId)}</string>
        <key>bundle-version</key>
        <string>1.0.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>Mismari+</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;
      res.setHeader("Content-Type", "text/xml; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.send(plistXml);
      return;
    } catch (err: any) {
      console.error("[manifest] signing failed:", err?.message || err);
      // Fall through to serve unsigned manifest
    }
  }

  // ── Fallback: serve manifest pointing to raw IPA (unsigned) ──
  let rawIpaUrl = effectiveIpaUrl;
  let ipaUrl: string;
  if (rawIpaUrl.startsWith("http")) {
    ipaUrl = rawIpaUrl.replace(/\/api\/admin\/FilesIPA\/StoreIPA\//, "/admin/FilesIPA/StoreIPA/");
  } else {
    ipaUrl = `${base}${rawIpaUrl}`;
  }

  const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${xmlEscape(ipaUrl)}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${xmlEscape(bundleId)}</string>
        <key>bundle-version</key>
        <string>1.0.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>Mismari+</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.send(plistXml);
});

// ─── POST /activate/complete — save user info to subscription ─────────────────
router.post("/activate/complete", completeLimiter, async (req, res): Promise<void> => {
  const { subscriptionId, name, phone, email, udid, deviceType } = req.body as {
    subscriptionId?: number;
    name?: string;
    phone?: string;
    email?: string;
    udid?: string;
    deviceType?: string;
  };

  if (!subscriptionId) {
    res.status(400).json({ error: "subscriptionId مطلوب" });
    return;
  }
  if (!name?.trim()) {
    res.status(400).json({ error: "الاسم مطلوب" });
    return;
  }
  if (!phone?.trim()) {
    res.status(400).json({ error: "رقم الهاتف مطلوب" });
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, Number(subscriptionId)))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: "الاشتراك غير موجود" });
    return;
  }

  // ── Block re-activation of a fully registered subscription ─────────────────
  // If both subscriberName AND udid are already set, this subscription has been
  // fully activated. Reject to prevent data overwrite attacks.
  if (sub.subscriberName && sub.udid) {
    res.status(409).json({
      error: "هذا الاشتراك مُفعَّل بالفعل",
      alreadyActivated: true,
      subscriberId: sub.id,
      code: sub.code,
    });
    return;
  }

  const now = new Date();
  // Never overwrite an existing UDID — only bind on first activation
  const finalUdid = sub.udid ? sub.udid : (udid?.trim() || null);
  const finalDeviceType = deviceType?.trim() || sub.deviceType || null;

  // ─── Save user info first ───────────────────────────────────────────────────
  const [updated] = await db
    .update(subscriptionsTable)
    .set({
      subscriberName: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || sub.email || null,
      udid: finalUdid,
      deviceType: finalDeviceType,
      activatedAt: sub.activatedAt || now,
      sourceType: "subscription_code",
      isActive: "true",
    })
    .where(eq(subscriptionsTable.id, Number(subscriptionId)))
    .returning();

  // ─── Get plan info ──────────────────────────────────────────────────────────
  const [plan] = await db
    .select({ name: plansTable.name, nameAr: plansTable.nameAr })
    .from(plansTable)
    .where(eq(plansTable.id, updated.planId))
    .limit(1);

  // ─── Register device with Apple if UDID + group available ──────────────────
  let appleMessage: string | null = null;
  if (finalUdid && updated.groupName) {
    try {
      const dt = (finalDeviceType === "iPad") ? "iPad" : "iPhone";
      const appleResult = await registerDeviceWithApple({
        certName: updated.groupName,
        udid: finalUdid,
        deviceType: dt,
        deviceName: name.trim(),
      });

      if (appleResult.success) {
        await db
          .update(subscriptionsTable)
          .set({
            applePlatform: appleResult.platform ?? null,
            appleDeviceId: appleResult.deviceId ?? null,
            appleStatus: "registered",
          })
          .where(eq(subscriptionsTable.id, updated.id));

        appleMessage = appleResult.platform === "MAC"
          ? "تم تسجيل الجهاز (Mac bypass)"
          : "تم تسجيل الجهاز مع Apple";
      } else {
        await db
          .update(subscriptionsTable)
          .set({ appleStatus: "failed" })
          .where(eq(subscriptionsTable.id, updated.id));
        console.error("[activate/complete] Apple registration failed:", appleResult.error);
      }
    } catch (err) {
      console.error("[activate/complete] Apple registration error:", err);
    }
  }

  // ─── Get group store IPA link (prefer ipaUrl over legacy storeIpaPath) ────────
  let storeDownloadLink: string | null = null;
  if (updated.groupName) {
    const [group] = await db
      .select({ storeIpaPath: groupsTable.storeIpaPath, ipaUrl: groupsTable.ipaUrl, certName: groupsTable.certName })
      .from(groupsTable)
      .where(eq(groupsTable.certName, updated.groupName))
      .limit(1);
    if (group && (group.ipaUrl || group.storeIpaPath)) {
      const base = getBaseUrl(req);
      storeDownloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/api/groups/${encodeURIComponent(group.certName)}/manifest.plist`)}`;
    }
  }

  res.json({
    success: true,
    appleMessage,
    subscriber: {
      id: updated.id,
      code: updated.code,
      subscriberName: updated.subscriberName,
      phone: updated.phone,
      email: updated.email,
      udid: updated.udid,
      deviceType: updated.deviceType,
      groupName: updated.groupName,
      isActive: updated.isActive,
      balance: updated.balance ?? 0,
      activatedAt: updated.activatedAt,
      expiresAt: updated.expiresAt,
      createdAt: updated.createdAt,
      planName: plan?.nameAr || plan?.name || null,
      planNameAr: plan?.nameAr || null,
    },
    storeDownloadLink,
  });
});

// ─── Admin: Upload store IPA for a group ──────────────────────────────────────
router.post(
  "/admin/groups/:id/store-ipa",
  adminAuth,
  storeIpaUpload.single("ipa"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    if (!req.file) {
      res.status(400).json({ error: "ipa file required" });
      return;
    }

    // Build public URL — WITHOUT /api/ prefix so iOS can download it directly
    const base = getBaseUrl(req);
    const ipaUrl = `${base}/admin/FilesIPA/StoreIPA/${req.file.filename}`;

    const [group] = await db
      .update(groupsTable)
      .set({ storeIpaPath: ipaUrl })
      .where(eq(groupsTable.id, id))
      .returning();

    if (!group) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    const downloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/api/groups/${encodeURIComponent(group.certName)}/manifest.plist`)}`;

    res.json({ success: true, storeIpaPath: ipaUrl, downloadLink });
  }
);

// ─── Admin: Remove store IPA from a group ────────────────────────────────────
router.delete("/admin/groups/:id/store-ipa", adminAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);

  const [group] = await db
    .update(groupsTable)
    .set({ storeIpaPath: null })
    .where(eq(groupsTable.id, id))
    .returning();

  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

// ─── Admin: Get download link for a group ────────────────────────────────────
router.get("/admin/groups/:certName/download-link", adminAuth, async (req, res): Promise<void> => {
  const { certName } = req.params;

  const [group] = await db
    .select({ storeIpaPath: groupsTable.storeIpaPath, certName: groupsTable.certName })
    .from(groupsTable)
    .where(eq(groupsTable.certName, decodeURIComponent(certName)))
    .limit(1);

  if (!group) { res.status(404).json({ error: "Not found" }); return; }

  if (!group.storeIpaPath) {
    res.json({ hasIpa: false, downloadLink: null });
    return;
  }

  const base = getBaseUrl(req);
  const downloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/api/groups/${encodeURIComponent(group.certName)}/manifest.plist`)}`;
  res.json({ hasIpa: true, downloadLink, storeIpaPath: group.storeIpaPath });
});

// NOTE: PUT /admin/groups/ipa-url-all was moved to admin.ts to ensure correct route
// ordering (must appear before PUT /admin/groups/:id to avoid id="ipa-url-all" clash)

// ─── Admin: Upload Mismari+ IPA to ALL groups ────────────────────────────────
// One upload → assign same storeIpaPath to every group
router.post(
  "/admin/groups/store-ipa-all",
  adminAuth,
  storeIpaUpload.single("ipa"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "ipa file required" });
      return;
    }

    const base = getBaseUrl(req);
    // WITHOUT /api/ prefix so iOS can download directly via the static handler
    const ipaUrl = `${base}/admin/FilesIPA/StoreIPA/${req.file.filename}`;

    // Update ALL groups
    const groups = await db
      .update(groupsTable)
      .set({ storeIpaPath: ipaUrl })
      .returning({ id: groupsTable.id, certName: groupsTable.certName });

    res.json({
      success: true,
      updatedCount: groups.length,
      ipaUrl,
      groups: groups.map(g => g.certName),
    });
  }
);

export default router;

