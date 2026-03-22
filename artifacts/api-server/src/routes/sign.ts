import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import plist from "plist";
import AdmZip from "adm-zip";
import pLimit from "p-limit";
import rateLimit from "express-rate-limit";
import { db, subscriptionsTable, groupsTable, appsTable } from "@workspace/db";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

// ─── Rate limiter for signing (heavy CPU operation) ───────────────────────────
const signLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات توقيع كثيرة جداً، حاول بعد قليل" },
});

// ─── Concurrency limiter: max 2 zsign operations at once ───────────────────
const signLimit = pLimit(2);

const ZSIGN_BIN = path.join(process.cwd(), "bin", "zsign");
const SIGNED_DIR = path.join(process.cwd(), "uploads", "Signed");

fs.mkdirSync(SIGNED_DIR, { recursive: true });

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function randomHex(n = 16) {
  return crypto.randomBytes(n).toString("hex");
}

function getBaseUrl(req: import("express").Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = (req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string) || "";
  return `${proto}://${host}`;
}

interface TokenMeta {
  appName: string;
  appVersion: string;
  bundleId: string;
  ipaPath: string;
  expiresAt: number;
}

function saveToken(token: string, meta: TokenMeta) {
  const metaPath = path.join(SIGNED_DIR, `${token}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta));
}

function loadToken(token: string): TokenMeta | null {
  const metaPath = path.join(SIGNED_DIR, `${token}.json`);
  if (!fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as TokenMeta;
    if (Date.now() > meta.expiresAt) {
      fs.rmSync(metaPath, { force: true });
      fs.rmSync(path.join(SIGNED_DIR, `${token}.ipa`), { force: true });
      return null;
    }
    return meta;
  } catch {
    return null;
  }
}

async function cleanupExpiredTokens() {
  try {
    const all = fs.readdirSync(SIGNED_DIR);
    const jsonFiles = all.filter(f => f.endsWith(".json"));
    const ipaFiles  = all.filter(f => f.endsWith(".ipa"));
    let deletedCount = 0;
    let freedBytes   = 0;

    // 1. Expire JSON tokens (sync read, async delete)
    const expiredTokens = new Set<string>();
    for (const f of jsonFiles) {
      const token    = f.replace(".json", "");
      const metaPath = path.join(SIGNED_DIR, f);
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as TokenMeta;
        if (Date.now() > meta.expiresAt) {
          expiredTokens.add(token);
          await fs.promises.unlink(metaPath).catch(() => {});
          deletedCount++;
        }
      } catch {
        expiredTokens.add(token);
        await fs.promises.unlink(metaPath).catch(() => {});
      }
    }

    // 2. Delete IPA files whose token expired or has no JSON (async — non-blocking)
    const jsonValid = new Set(jsonFiles.map(f => f.replace(".json", "")));
    for (const f of ipaFiles) {
      const token   = f.replace(".ipa", "");
      const ipaPath = path.join(SIGNED_DIR, f);
      if (expiredTokens.has(token) || !jsonValid.has(token)) {
        try {
          const stat = fs.statSync(ipaPath);
          freedBytes += stat.size;
        } catch {}
        await fs.promises.unlink(ipaPath).catch(() => {});
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      const freedMB = (freedBytes / 1024 / 1024).toFixed(1);
      console.log(`[sign/cleanup] Deleted ${deletedCount} files, freed ${freedMB} MB`);
    }
  } catch (e) {
    console.error("[sign/cleanup] Error:", e);
  }
}

async function signIpa(opts: {
  p12Base64: string;
  p12Password: string;
  mpBase64: string;
  inputPath: string;
  outputPath: string;
  bundleId?: string;
  bundleName?: string;
}): Promise<void> {
  // ── Wrap in p-limit: max 2 concurrent zsign processes ──────────────────
  await signLimit(async () => {
    const tmpDir = fs.mkdtempSync("/tmp/zsign-");
    try {
      const p12Path = path.join(tmpDir, "cert.p12");
      const mpPath = path.join(tmpDir, "app.mobileprovision");
      fs.writeFileSync(p12Path, Buffer.from(opts.p12Base64, "base64"));
      fs.writeFileSync(mpPath, Buffer.from(opts.mpBase64, "base64"));

      const args: string[] = [
        "-k", p12Path,
        "-p", opts.p12Password || "",
        "-m", mpPath,
        "-o", opts.outputPath,
        "-z", "6",
      ];
      if (opts.bundleId)   { args.push("-b", opts.bundleId); }
      if (opts.bundleName) { args.push("-n", opts.bundleName); }
      args.push(opts.inputPath);

      await execFileAsync(ZSIGN_BIN, args, {
        timeout: 10 * 60 * 1000,   // 10 min — covers large 2GB+ IPAs
        maxBuffer: 10 * 1024 * 1024,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
}

// ─── Stable suffix for clone Bundle IDs ──────────────────────────────────────
// Same code+appId always → same suffix → user keeps clone data after reinstall
function stableCloneSuffix(code: string, appId: number): string {
  const hash = crypto.createHash("sha256").update(`${code}:${appId}`).digest("hex");
  // Convert first 4 hex chars to a 2-digit number (10–99)
  const num = (parseInt(hash.slice(0, 4), 16) % 90) + 10;
  return `m${num}`;
}

function resolveLocalPath(storedPath: string): string {
  if (!storedPath) return "";
  // URL format: https://host/api/admin/FilesIPA/StoreIPA/file.ipa
  // → local: uploads/StoreIPA/file.ipa
  // or: https://host/api/admin/FilesIPA/IpaApp/file.ipa
  // → local: uploads/FilesIPA/IpaApp/file.ipa
  if (storedPath.startsWith("http")) {
    const url = new URL(storedPath);
    const p = url.pathname;
    // /api/admin/FilesIPA/StoreIPA/file.ipa → uploads/StoreIPA/file.ipa
    const storeMatch = p.match(/\/FilesIPA\/StoreIPA\/(.+)$/);
    if (storeMatch) return path.join(process.cwd(), "uploads", "StoreIPA", storeMatch[1]);
    // /api/admin/FilesIPA/IpaApp/file.ipa → uploads/FilesIPA/IpaApp/file.ipa
    const appMatch = p.match(/\/FilesIPA\/IpaApp\/(.+)$/);
    if (appMatch) return path.join(process.cwd(), "uploads", "FilesIPA", "IpaApp", appMatch[1]);
    // /admin/FilesIPA/... (old relative stored as URL)
    const relMatch = p.match(/\/admin\/FilesIPA\/(.+)$/);
    if (relMatch) return path.join(process.cwd(), "uploads", "FilesIPA", relMatch[1]);
    return path.join(process.cwd(), "uploads", path.basename(p));
  }
  // Relative path like /admin/FilesIPA/IpaApp/file.ipa
  if (storedPath.startsWith("/admin/FilesIPA/StoreIPA/")) {
    return path.join(process.cwd(), "uploads", "StoreIPA", path.basename(storedPath));
  }
  if (storedPath.startsWith("/admin/FilesIPA/IpaApp/")) {
    return path.join(process.cwd(), "uploads", "FilesIPA", "IpaApp", path.basename(storedPath));
  }
  if (storedPath.startsWith("/")) {
    return path.join(process.cwd(), storedPath.slice(1));
  }
  return path.join(process.cwd(), storedPath);
}

function readIpaInfo(ipaPath: string): { name: string; version: string; bundleId: string } {
  try {
    const zip = new AdmZip(ipaPath);
    const entries = zip.getEntries();
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.entryName));
    if (!plistEntry) return { name: "App", version: "1.0", bundleId: "com.app" };
    const data = plist.parse(plistEntry.getData().toString("utf8")) as Record<string, any>;
    return {
      name: data["CFBundleDisplayName"] || data["CFBundleName"] || "App",
      version: data["CFBundleShortVersionString"] || data["CFBundleVersion"] || "1.0",
      bundleId: data["CFBundleIdentifier"] || "com.app",
    };
  } catch {
    return { name: "App", version: "1.0", bundleId: "com.app" };
  }
}

async function getSubAndGroup(code: string) {
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.code, code));
  if (!sub) throw new Error("كود الاشتراك غير موجود");
  if (sub.isActive !== "true") throw new Error("الاشتراك غير فعّال");
  if (!sub.groupName) throw new Error("لا توجد مجموعة مرتبطة بهذا الاشتراك");

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.certName, sub.groupName));
  if (!group) throw new Error("المجموعة غير موجودة");
  if (!group.p12Data || !group.mobileprovisionData) {
    throw new Error("المجموعة لا تحتوي على شهادة توقيع (p12 + mobileprovision)");
  }
  return { sub, group };
}

function buildItmsUrl(baseUrl: string, manifestUrl: string): string {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
}

function buildManifestPlist(opts: {
  ipaUrl: string;
  bundleId: string;
  version: string;
  appName: string;
}): string {
  const data = {
    items: [
      {
        assets: [
          { kind: "software-package", url: opts.ipaUrl },
        ],
        metadata: {
          "bundle-identifier": opts.bundleId,
          "bundle-version": opts.version,
          kind: "software",
          title: opts.appName,
        },
      },
    ],
  };
  return plist.build(data);
}

// ─── Cleanup expired tokens every 10 min ────────────────────────────────────
cleanupExpiredTokens();
setInterval(() => { cleanupExpiredTokens().catch(() => {}); }, 10 * 60 * 1000);

// ─── GET /api/sign/status — queue depth for frontend polling ────────────────
router.get("/sign/status", (_req, res): void => {
  res.json({
    active:  signLimit.activeCount,
    pending: signLimit.pendingCount,
    // position = how many are ahead (active + pending); 0 means start immediately
    ahead: signLimit.activeCount + signLimit.pendingCount,
  });
});

// ─── GET /api/sign/manifest/:token.plist ────────────────────────────────────
router.get("/sign/manifest/:token.plist", (req, res): void => {
  const token = req.params.token;
  const meta = loadToken(token);
  if (!meta) {
    res.status(404).json({ error: "الرابط منتهي الصلاحية أو غير موجود" });
    return;
  }
  const baseUrl = getBaseUrl(req);
  const ipaUrl = `${baseUrl}/api/sign/ipa/${token}.ipa`;
  const manifestXml = buildManifestPlist({
    ipaUrl,
    bundleId: meta.bundleId,
    version: meta.appVersion,
    appName: meta.appName,
  });
  res.setHeader("Content-Type", "application/x-apple-aspen-config");
  res.send(manifestXml);
});

// ─── GET /api/sign/ipa/:token.ipa ────────────────────────────────────────────
router.get("/sign/ipa/:token.ipa", (req, res): void => {
  const token = req.params.token;
  const meta = loadToken(token);
  if (!meta) {
    res.status(404).json({ error: "الرابط منتهي الصلاحية أو غير موجود" });
    return;
  }
  const ipaPath = path.join(SIGNED_DIR, `${token}.ipa`);
  if (!fs.existsSync(ipaPath)) {
    res.status(404).json({ error: "ملف IPA غير موجود" });
    return;
  }
  const stat = fs.statSync(ipaPath);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${meta.appName.replace(/[^a-z0-9]/gi, "_")}.ipa"`);
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(ipaPath).pipe(res);
});

// ─── POST /api/sign/store/:code ──────────────────────────────────────────────
// Signs the group's store IPA for this subscriber → returns itms-services URL
router.post("/sign/store/:code", signLimiter, async (req, res): Promise<void> => {
  try {
    const { code } = req.params;
    const { sub, group } = await getSubAndGroup(code);

    if (!group.storeIpaPath) {
      res.status(400).json({ error: "هذه المجموعة لا تحتوي على ملف IPA للمتجر. يرجى رفع الملف من لوحة الإدارة." });
      return;
    }

    const inputPath = resolveLocalPath(group.storeIpaPath);

    if (!fs.existsSync(inputPath)) {
      res.status(400).json({ error: "ملف IPA للمتجر غير موجود على السيرفر" });
      return;
    }

    const appInfo = readIpaInfo(inputPath);
    const token = randomHex(16);
    const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);

    await signIpa({
      p12Base64: group.p12Data!,
      p12Password: group.p12Password || "",
      mpBase64: group.mobileprovisionData!,
      inputPath,
      outputPath,
    });

    const meta: TokenMeta = {
      appName: appInfo.name,
      appVersion: appInfo.version,
      bundleId: appInfo.bundleId,
      ipaPath: outputPath,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    };
    saveToken(token, meta);

    const baseUrl = getBaseUrl(req);
    const manifestUrl = `${baseUrl}/api/sign/manifest/${token}.plist`;
    const itmsUrl = buildItmsUrl(baseUrl, manifestUrl);

    res.json({
      token,
      itmsUrl,
      manifestUrl,
      appName: appInfo.name,
      appVersion: appInfo.version,
      bundleId: appInfo.bundleId,
      expiresAt: new Date(meta.expiresAt).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل التوقيع" });
  }
});

// ─── POST /api/sign/app/:code/:appId ─────────────────────────────────────────
// Signs a specific app for this subscriber
router.post("/sign/app/:code/:appId", signLimiter, async (req, res): Promise<void> => {
  try {
    const { code, appId } = req.params;
    const appIdNum = parseInt(appId, 10);
    if (isNaN(appIdNum)) { res.status(400).json({ error: "معرّف التطبيق غير صالح" }); return; }

    const { sub, group } = await getSubAndGroup(code);

    const [app] = await db.select().from(appsTable).where(eq(appsTable.id, appIdNum));
    if (!app) { res.status(404).json({ error: "التطبيق غير موجود" }); return; }
    if (!app.ipaPath) { res.status(400).json({ error: "ملف IPA غير موجود لهذا التطبيق" }); return; }

    const inputPath = resolveLocalPath(app.ipaPath);
    if (!fs.existsSync(inputPath)) {
      res.status(400).json({ error: "ملف IPA غير موجود على السيرفر" }); return;
    }

    const appInfo = readIpaInfo(inputPath);
    const token = randomHex(16);
    const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);

    await signIpa({
      p12Base64: group.p12Data!,
      p12Password: group.p12Password || "",
      mpBase64: group.mobileprovisionData!,
      inputPath,
      outputPath,
    });

    const meta: TokenMeta = {
      appName: app.name || appInfo.name,
      appVersion: app.version || appInfo.version,
      bundleId: app.bundleId || appInfo.bundleId,
      ipaPath: outputPath,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    };
    saveToken(token, meta);

    const baseUrl = getBaseUrl(req);
    const manifestUrl = `${baseUrl}/api/sign/manifest/${token}.plist`;
    const itmsUrl = buildItmsUrl(baseUrl, manifestUrl);

    await db.update(appsTable).set({ downloads: (app.downloads || 0) + 1 }).where(eq(appsTable.id, appIdNum));

    res.json({
      token,
      itmsUrl,
      manifestUrl,
      appName: app.name || appInfo.name,
      appVersion: app.version || appInfo.version,
      bundleId: app.bundleId || appInfo.bundleId,
      expiresAt: new Date(meta.expiresAt).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل التوقيع" });
  }
});

// ─── POST /api/sign/clone/:code/:appId ───────────────────────────────────────
// Clones an app (new Bundle ID) and signs for this subscriber
router.post("/sign/clone/:code/:appId", signLimiter, async (req, res): Promise<void> => {
  try {
    const { code, appId } = req.params;
    const { newName } = req.body as { newName?: string };
    const appIdNum = parseInt(appId, 10);
    if (isNaN(appIdNum)) { res.status(400).json({ error: "معرّف التطبيق غير صالح" }); return; }

    const { sub, group } = await getSubAndGroup(code);

    const [app] = await db.select().from(appsTable).where(eq(appsTable.id, appIdNum));
    if (!app) { res.status(404).json({ error: "التطبيق غير موجود" }); return; }
    if (!app.ipaPath) { res.status(400).json({ error: "ملف IPA غير موجود لهذا التطبيق" }); return; }

    const inputPath = resolveLocalPath(app.ipaPath);
    if (!fs.existsSync(inputPath)) {
      res.status(400).json({ error: "ملف IPA غير موجود على السيرفر" }); return;
    }

    const appInfo = readIpaInfo(inputPath);
    const suffix = stableCloneSuffix(code, appIdNum);
    const newBundleId = `${app.bundleId || appInfo.bundleId}.${suffix}`;
    const cloneName = newName?.trim() || `${app.name || appInfo.name} 2`;

    const token = randomHex(16);
    const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);

    await signIpa({
      p12Base64: group.p12Data!,
      p12Password: group.p12Password || "",
      mpBase64: group.mobileprovisionData!,
      inputPath,
      outputPath,
      bundleId: newBundleId,
      bundleName: cloneName,
    });

    const meta: TokenMeta = {
      appName: cloneName,
      appVersion: app.version || appInfo.version,
      bundleId: newBundleId,
      ipaPath: outputPath,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    };
    saveToken(token, meta);

    const baseUrl = getBaseUrl(req);
    const manifestUrl = `${baseUrl}/api/sign/manifest/${token}.plist`;
    const itmsUrl = buildItmsUrl(baseUrl, manifestUrl);

    res.json({
      token,
      itmsUrl,
      manifestUrl,
      appName: cloneName,
      appVersion: app.version || appInfo.version,
      originalBundleId: app.bundleId || appInfo.bundleId,
      newBundleId,
      expiresAt: new Date(meta.expiresAt).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل التوقيع والتكرار" });
  }
});

export default router;
