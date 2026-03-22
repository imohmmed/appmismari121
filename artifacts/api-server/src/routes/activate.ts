import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import multer from "multer";
import { db, subscriptionsTable, groupsTable, plansTable } from "@workspace/db";

const router: IRouter = Router();

function getBaseUrl(req: import("express").Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string) || "";
  return `${proto}://${host}`;
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
router.post("/activate/validate", async (req, res): Promise<void> => {
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

  if (sub.isActive === "false") {
    res.status(400).json({ valid: false, error: "هذا الاشتراك منتهي الصلاحية" });
    return;
  }

  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    res.status(400).json({ valid: false, error: "انتهت صلاحية هذا الاشتراك" });
    return;
  }

  // If already has info registered
  if (sub.subscriberName && sub.udid) {
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

  // Get group info + store IPA path
  let downloadLink: string | null = null;
  let groupBundleId: string | null = null;
  if (sub.groupName) {
    const [group] = await db
      .select({ storeIpaPath: groupsTable.storeIpaPath, bundleId: groupsTable.bundleId, certName: groupsTable.certName })
      .from(groupsTable)
      .where(eq(groupsTable.certName, sub.groupName))
      .limit(1);

    if (group?.storeIpaPath) {
      const base = getBaseUrl(req);
      downloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/api/groups/${encodeURIComponent(group.certName)}/manifest.plist`)}`;
    }
    groupBundleId = group?.bundleId || null;
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

// ─── GET /groups/:certName/manifest.plist — dynamic plist ────────────────────
router.get("/groups/:certName/manifest.plist", async (req, res): Promise<void> => {
  const { certName } = req.params;

  const [group] = await db
    .select({ storeIpaPath: groupsTable.storeIpaPath, certName: groupsTable.certName, bundleId: groupsTable.bundleId })
    .from(groupsTable)
    .where(eq(groupsTable.certName, decodeURIComponent(certName)))
    .limit(1);

  if (!group || !group.storeIpaPath) {
    res.status(404).send("Group not found or no IPA uploaded");
    return;
  }

  const base = getBaseUrl(req);
  // Derive the IPA URL from path
  const ipaUrl = group.storeIpaPath.startsWith("http")
    ? group.storeIpaPath
    : `${base}${group.storeIpaPath}`;

  const bundleId = group.bundleId || "com.mismari.store";

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
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
          <string>${ipaUrl}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${bundleId}</string>
        <key>bundle-version</key>
        <string>1.0</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>مسماري+</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.send(plist);
});

// ─── POST /activate/complete — save user info to subscription ─────────────────
router.post("/activate/complete", async (req, res): Promise<void> => {
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

  const now = new Date();
  const [updated] = await db
    .update(subscriptionsTable)
    .set({
      subscriberName: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || sub.email || null,
      udid: udid?.trim() || sub.udid || null,
      deviceType: deviceType?.trim() || sub.deviceType || null,
      activatedAt: sub.activatedAt || now,
      sourceType: "subscription_code",
      isActive: "true",
    })
    .where(eq(subscriptionsTable.id, Number(subscriptionId)))
    .returning();

  // Get plan info for response
  const [plan] = await db
    .select({ name: plansTable.name, nameAr: plansTable.nameAr })
    .from(plansTable)
    .where(eq(plansTable.id, updated.planId))
    .limit(1);

  // Get group store IPA link for response
  let storeDownloadLink: string | null = null;
  if (updated.groupName) {
    const [group] = await db
      .select({ storeIpaPath: groupsTable.storeIpaPath, certName: groupsTable.certName })
      .from(groupsTable)
      .where(eq(groupsTable.certName, updated.groupName))
      .limit(1);
    if (group?.storeIpaPath) {
      const base = getBaseUrl(req);
      storeDownloadLink = `itms-services://?action=download-manifest&url=${encodeURIComponent(`${base}/api/groups/${encodeURIComponent(group.certName)}/manifest.plist`)}`;
    }
  }

  res.json({
    success: true,
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
      activatedAt: updated.activatedAt,
      expiresAt: updated.expiresAt,
      planName: plan?.nameAr || plan?.name || null,
    },
    storeDownloadLink,
  });
});

// ─── Admin: Upload store IPA for a group ──────────────────────────────────────
router.post(
  "/admin/groups/:id/store-ipa",
  storeIpaUpload.single("ipa"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ error: "Invalid ID" }); return; }

    if (!req.file) {
      res.status(400).json({ error: "ipa file required" });
      return;
    }

    // Build public URL path for the IPA
    const base = getBaseUrl(req);
    const ipaUrl = `${base}/api/admin/FilesIPA/StoreIPA/${req.file.filename}`;

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
router.delete("/admin/groups/:id/store-ipa", async (req, res): Promise<void> => {
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
router.get("/admin/groups/:certName/download-link", async (req, res): Promise<void> => {
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

// ─── Admin: Upload Mismari+ IPA to ALL groups ────────────────────────────────
// One upload → assign same storeIpaPath to every group
router.post(
  "/admin/groups/store-ipa-all",
  storeIpaUpload.single("ipa"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "ipa file required" });
      return;
    }

    const base = getBaseUrl(req);
    const ipaUrl = `${base}/api/admin/FilesIPA/StoreIPA/${req.file.filename}`;

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

