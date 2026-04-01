import { Router, type IRouter } from "express";
import { eq, desc, gte, sql as sqlExpr } from "drizzle-orm";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import crypto from "crypto";
import { execFile, execSync } from "child_process";
import { promisify } from "util";
import plist from "plist";
import bplist from "bplist-parser";
import AdmZip from "adm-zip";
import pLimit from "p-limit";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { db, subscriptionsTable, groupsTable, appsTable, signJobsTable } from "@workspace/db";
import { adminAuth } from "../middleware/adminAuth";
import { r2Url } from "../lib/r2";
import {
  DYLIB_DIR, ANTIREVOKE_DYLIB_PATH, STORE_DYLIB_PATH,
  ensureDylib, ensureAppDylib, ensureStoreDylib, getDylibPath,
  flushDylibCache, getDylibCacheStatus,
} from "../lib/dylibs";

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

function findZsign(): string {
  const candidates = [
    path.join(process.cwd(), "bin", "zsign"),
    path.join(process.cwd(), "artifacts/api-server/bin", "zsign"),
    "/home/runner/workspace/artifacts/api-server/bin/zsign",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}
const ZSIGN_BIN = findZsign();
const SIGNED_DIR = path.join(process.cwd(), "uploads", "Signed");

fs.mkdirSync(SIGNED_DIR, { recursive: true });

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function randomHex(n = 16) {
  return crypto.randomBytes(n).toString("hex");
}

/** Parse a plist Buffer — handles both XML plists and binary plists (bplist00). */
function parsePlistBuffer(buf: Buffer): Record<string, any> {
  if (buf.length >= 6 && buf.slice(0, 6).toString("ascii") === "bplist") {
    const parsed = bplist.parseBuffer(buf);
    return (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, any>;
  }
  return plist.parse(buf.toString("utf8")) as Record<string, any>;
}

/** Validate that a token/filename is safe to use in path.join (hex-only, max 128 chars) */
function isValidToken(t: string): boolean {
  return /^[a-f0-9]{8,128}$/i.test(t);
}

/** Strip any directory traversal from a filename */
function safeFilename(f: string): string {
  return path.basename(f).replace(/[^a-zA-Z0-9._\-]/g, "_");
}

function getBaseUrl(req: import("express").Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return "https://app.mismari.com";
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
        timeout: 10 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
}

// ─── Dylib helpers (thin wrappers over ../lib/dylibs) ────────────────────────
function getAntiRevokeDylibPath(): string | null { return getDylibPath(ANTIREVOKE_DYLIB_PATH); }
function getStoreDylibPath(): string | null       { return getDylibPath(STORE_DYLIB_PATH); }
async function ensureStoreDylibLocal(): Promise<void> { return ensureStoreDylib(); }
async function ensureDylibLocal(): Promise<void>      { return ensureAppDylib(); }

/**
 * Resolves an IPA path for signing.
 * - Local file exists → returns {path, cleanup: noop}
 * - R2/HTTP URL (or local file missing) → downloads to /tmp, returns {path, cleanup: deletes temp}
 */
async function resolveIpaForSigning(storedPath: string): Promise<{ path: string; cleanup: () => void }> {
  const noop = () => {};

  // Fast path: check local disk first (avoids unnecessary network download)
  const localPath = resolveLocalPath(storedPath);
  if (fs.existsSync(localPath)) {
    return { path: localPath, cleanup: noop };
  }

  // Determine if the storedPath can be resolved via R2/CDN download
  // - Full HTTP URL → download directly
  // - R2 keys (FilesIPA/... or StoreIPA/...) → build dl.mismari.com URL
  // - Local-only paths (/sign/store-files/...) → error, no R2 fallback
  let downloadUrl: string | null = null;
  if (storedPath.startsWith("http")) {
    downloadUrl = storedPath;
  } else if (!storedPath.startsWith("/")) {
    // bare R2 key like "FilesIPA/IpaApp/xxx.ipa"
    downloadUrl = r2Url(storedPath);
  }

  if (downloadUrl) {
    const tmpPath = `/tmp/ipa-sign-${randomHex(8)}.ipa`;
    await downloadUrlToFile(downloadUrl, tmpPath);
    return { path: tmpPath, cleanup: () => fs.rmSync(tmpPath, { force: true }) };
  }

  throw new Error(`ملف IPA غير موجود: ${storedPath}`);
}

// ─── Stable suffix for clone Bundle IDs ──────────────────────────────────────
// Same code+appId always → same suffix → user keeps clone data after reinstall
function stableCloneSuffix(code: string, appId: number): string {
  const hash = crypto.createHash("sha256").update(`${code}:${appId}`).digest("hex");
  const num = (parseInt(hash.slice(0, 4), 16) % 90) + 10;
  return `m${num}`;
}

function readProvisioningBundleId(mpBase64: string): string | null {
  try {
    const buf = Buffer.from(mpBase64, "base64");
    const raw = buf.toString("utf8");
    const xmlMatch = raw.match(/<\?xml[\s\S]*<\/plist>/);
    if (!xmlMatch) return null;
    const data = plist.parse(xmlMatch[0]) as Record<string, any>;
    const entitlements = data["Entitlements"] as Record<string, any> | undefined;
    if (!entitlements) return null;
    return entitlements["application-identifier"]?.replace(/^[A-Z0-9]+\./, "") || null;
  } catch {
    return null;
  }
}

function isWildcardProfile(mpBase64: string): boolean {
  const bundleId = readProvisioningBundleId(mpBase64);
  return bundleId === "*" || (bundleId?.endsWith(".*") ?? false);
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
  // Signed store IPA: "/sign/store-files/<filename>" → uploads/SignedStore/<filename>
  if (storedPath.startsWith("/sign/store-files/")) {
    return path.join(process.cwd(), "uploads", "SignedStore", path.basename(storedPath));
  }
  // SignedStore bare key: "SignedStore/<filename>" → uploads/SignedStore/<filename>
  if (storedPath.startsWith("SignedStore/")) {
    return path.join(process.cwd(), "uploads", storedPath);
  }
  if (storedPath.startsWith("/")) {
    return path.join(process.cwd(), storedPath.slice(1));
  }
  // Bare R2 keys: "FilesIPA/IpaApp/file.ipa" or "StoreIPA/file.ipa"
  if (storedPath.startsWith("FilesIPA/") || storedPath.startsWith("StoreIPA/")) {
    return path.join(process.cwd(), "uploads", storedPath);
  }
  return path.join(process.cwd(), storedPath);
}

function readIpaInfo(ipaPath: string): { name: string; version: string; bundleId: string; iconBase64?: string } {
  try {
    const zip = new AdmZip(ipaPath);
    const entries = zip.getEntries();
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.entryName));
    if (!plistEntry) return { name: "App", version: "1.0", bundleId: "com.app" };

    // Parse plist — handle both XML and binary formats
    let data: Record<string, any> = {};
    try {
      data = parsePlistBuffer(plistEntry.getData());
    } catch { data = {}; }

    const appFolder = plistEntry.entryName.replace("Info.plist", "");

    // Try to extract app icon
    let iconBase64: string | undefined;
    try {
      const primaryIcons =
        data["CFBundleIcons"]?.["CFBundlePrimaryIcon"]?.["CFBundleIconFiles"] ||
        data["CFBundleIcons~ipad"]?.["CFBundlePrimaryIcon"]?.["CFBundleIconFiles"] ||
        data["CFBundleIconFiles"] ||
        [];
      const iconName: string | undefined = Array.isArray(primaryIcons)
        ? primaryIcons[primaryIcons.length - 1]
        : undefined;
      if (iconName) {
        // Prefer @3x then @2x then plain
        const candidates = [`${iconName}@3x.png`, `${iconName}@2x.png`, `${iconName}.png`, iconName];
        for (const candidate of candidates) {
          const entry = entries.find(e => e.entryName === `${appFolder}${candidate}`);
          if (entry) { iconBase64 = entry.getData().toString("base64"); break; }
        }
      }
      // Fallback: look for any AppIcon PNG in the app bundle
      if (!iconBase64) {
        const iconEntry = entries.find(e =>
          e.entryName.startsWith(appFolder) &&
          /AppIcon.*\.png$/i.test(e.entryName) &&
          !e.entryName.includes("/")
        );
        if (iconEntry) iconBase64 = iconEntry.getData().toString("base64");
      }
    } catch { /* icon extraction optional */ }

    return {
      name: data["CFBundleDisplayName"] || data["CFBundleName"] || "App",
      version: data["CFBundleShortVersionString"] || data["CFBundleVersion"] || "1.0",
      bundleId: data["CFBundleIdentifier"] || "com.app",
      iconBase64,
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

// ─── GET /api/sign/dl/:token — token-protected IPA download ─────────────────
// iOS downloads signed store IPAs via itms-services:// which cannot send
// auth headers. We embed a 32-byte random token in the URL instead.
// The token is stored in the DB on the group row and validated on every request.
const SIGNED_STORE_DIR_PUBLIC = path.join(process.cwd(), "uploads", "SignedStore");
router.get("/sign/dl/:token", async (req, res): Promise<void> => {
  const { token } = req.params;
  if (!token || !/^[a-zA-Z0-9_\-]{16,128}$/.test(token)) { res.status(400).send("Invalid token"); return; }

  // Look up which group this token belongs to and get the file path
  const [group] = await db
    .select({ storeIpaPath: groupsTable.storeIpaPath })
    .from(groupsTable)
    .where(eq(groupsTable.ipaDownloadToken, token));

  if (!group || !group.storeIpaPath) {
    res.status(404).json({ error: "الرابط غير صالح أو منتهي" });
    return;
  }

  // storeIpaPath is stored as "/sign/store-files/<filename>" — use basename only
  const filename = safeFilename(group.storeIpaPath);

  const filePath = path.join(SIGNED_STORE_DIR_PUBLIC, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "ملف غير موجود على السيرفر" });
    return;
  }

  const stat = fs.statSync(filePath);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="Mismari-Plus.ipa"`);
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(filePath).pipe(res);
});

// ─── GET /api/sign/store-files/:filename — fallback file serve ───────────────
// Used by storeIpaPath references. Serves directly from uploads/SignedStore.
router.get("/sign/store-files/:filename", (req, res): void => {
  const filename = safeFilename(req.params.filename);
  if (!filename || filename === "_") { res.status(400).send("Invalid"); return; }
  const filePath = path.join(SIGNED_STORE_DIR_PUBLIC, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "ملف غير موجود" }); return; }
  const stat = fs.statSync(filePath);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="Mismari-Plus.ipa"`);
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(filePath).pipe(res);
});

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
  if (!isValidToken(token)) { res.status(400).json({ error: "Invalid token" }); return; }
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
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.send(manifestXml);
});

// ─── HEAD /api/sign/ipa/:token.ipa ───────────────────────────────────────────
router.head("/sign/ipa/:token.ipa", (req, res): void => {
  const token = req.params.token;
  if (!isValidToken(token)) { res.status(400).end(); return; }
  const meta = loadToken(token);
  if (!meta) { res.status(404).end(); return; }
  const ipaPath = path.join(SIGNED_DIR, `${token}.ipa`);
  if (!fs.existsSync(ipaPath)) { res.status(404).end(); return; }
  const stat = fs.statSync(ipaPath);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", String(stat.size));
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Content-Disposition", `attachment; filename="${meta.appName.replace(/[^a-z0-9]/gi, "_")}.ipa"`);
  res.status(200).end();
});

// ─── GET /api/sign/ipa/:token.ipa ────────────────────────────────────────────
router.get("/sign/ipa/:token.ipa", (req, res): void => {
  const token = req.params.token;
  if (!isValidToken(token)) { res.status(400).json({ error: "Invalid token" }); return; }
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
  const totalSize = stat.size;
  const fileName = meta.appName.replace(/[^a-z0-9]/gi, "_") + ".ipa";

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Connection", "keep-alive");

  const rangeHeader = req.headers["range"];
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end   = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      if (start > end || end >= totalSize) {
        res.setHeader("Content-Range", `bytes */${totalSize}`);
        res.status(416).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      res.setHeader("Content-Length", String(chunkSize));
      res.status(206);
      fs.createReadStream(ipaPath, { start, end }).pipe(res);
      return;
    }
  }

  res.setHeader("Content-Length", String(totalSize));
  res.status(200);
  fs.createReadStream(ipaPath).pipe(res);
});

// ─── POST /api/sign/store/:code ──────────────────────────────────────────────
// Signs the group's store IPA for this subscriber → returns itms-services URL
router.post("/sign/store/:code", signLimiter, async (req, res): Promise<void> => {
  let cleanup = () => {};
  try {
    const { code } = req.params;
    const { sub, group } = await getSubAndGroup(code);

    if (!group.storeIpaPath) {
      res.status(400).json({ error: "هذه المجموعة لا تحتوي على ملف IPA للمتجر. يرجى رفع الملف من لوحة الإدارة." });
      return;
    }

    const resolved = await resolveIpaForSigning(group.storeIpaPath);
    const inputPath = resolved.path;
    cleanup = resolved.cleanup;

    const appInfo = readIpaInfo(inputPath);
    const token = randomHex(16);
    const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);
    // ✅ Inject mismari-store.dylib (store-specific: JB bypass, safe mode, welcome, auto-update)
    // ⚠️ Do NOT inject antirevoke.dylib here — it crashes React Native / Hermes at launch
    await ensureStoreDylibLocal();
    const storeDylibPath = getStoreDylibPath();
    await signIpa({
      p12Base64: group.p12Data!,
      p12Password: group.p12Password || "",
      mpBase64: group.mobileprovisionData!,
      inputPath,
      outputPath,
      dylibPaths: storeDylibPath ? [storeDylibPath] : undefined,
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
  } finally {
    cleanup();
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

    // ── Quota check ──────────────────────────────────────────────────────────
    const preUsed = await getTodayUsedBytes(code);
    if (preUsed >= QUOTA_BYTES) {
      res.status(429).json({ error: "تجاوزت الحصة اليومية (4 GB). حاول غداً." }); return;
    }

    const [app] = await db.select().from(appsTable).where(eq(appsTable.id, appIdNum));
    if (!app) { res.status(404).json({ error: "التطبيق غير موجود" }); return; }
    if (!app.ipaPath) { res.status(400).json({ error: "ملف IPA غير موجود لهذا التطبيق" }); return; }

    await ensureDylibLocal();
    const resolved = await resolveIpaForSigning(app.ipaPath);
    const inputPath = resolved.path;

    const appInfo = readIpaInfo(inputPath);
    const token = randomHex(16);
    const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);
    const dylibPath = getAntiRevokeDylibPath();

    try {
      await signIpa({
        p12Base64: group.p12Data!,
        p12Password: group.p12Password || "",
        mpBase64: group.mobileprovisionData!,
        inputPath,
        outputPath,
        dylibPaths: dylibPath ? [dylibPath] : undefined,
      });
    } finally {
      resolved.cleanup();
    }

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

    // ── Record quota usage ────────────────────────────────────────────────────
    const signedSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    await db.insert(signJobsTable).values({
      jobId: crypto.randomUUID(),
      subscriberCode: code,
      status: "done",
      sourceType: "store-app",
      sourceUrl: app.ipaPath || null,
      customName: app.name || null,
      fileSize: signedSize,
    });

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

    // ── Quota check ──────────────────────────────────────────────────────────
    const preUsedClone = await getTodayUsedBytes(code);
    if (preUsedClone >= QUOTA_BYTES) {
      res.status(429).json({ error: "تجاوزت الحصة اليومية (4 GB). حاول غداً." }); return;
    }

    const [app] = await db.select().from(appsTable).where(eq(appsTable.id, appIdNum));
    if (!app) { res.status(404).json({ error: "التطبيق غير موجود" }); return; }
    if (!app.ipaPath) { res.status(400).json({ error: "ملف IPA غير موجود لهذا التطبيق" }); return; }

    await ensureDylibLocal();
    const resolved = await resolveIpaForSigning(app.ipaPath);
    const inputPath = resolved.path;
    const appInfo = readIpaInfo(inputPath);
    const cloneName = newName?.trim() || `${app.name || appInfo.name} 2`;
    const originalBundleId = app.bundleId || appInfo.bundleId;

    // Always derive a unique bundle ID from the original app's bundle ID.
    // Using the profile's bundle ID for non-wildcard profiles causes conflicts
    // with the already-installed Mismari+ store app (same com.mismari.app bundle ID).
    const suffix = stableCloneSuffix(code, appIdNum);
    const newBundleId = `${originalBundleId}.${suffix}`;

    const token = randomHex(16);
    const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);
    const dylibPath = getAntiRevokeDylibPath();

    try {
      await signIpa({
        p12Base64: group.p12Data!,
        p12Password: group.p12Password || "",
        mpBase64: group.mobileprovisionData!,
        inputPath,
        outputPath,
        bundleId: newBundleId,
        bundleName: cloneName,
        dylibPaths: dylibPath ? [dylibPath] : undefined,
      });
    } finally {
      resolved.cleanup();
    }

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

    // ── Record quota usage ────────────────────────────────────────────────────
    const cloneSignedSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
    await db.insert(signJobsTable).values({
      jobId: crypto.randomUUID(),
      subscriberCode: code,
      status: "done",
      sourceType: "store-clone",
      sourceUrl: app.ipaPath || null,
      customName: cloneName,
      customBundleId: newBundleId,
      fileSize: cloneSignedSize,
    });

    res.json({
      token,
      itmsUrl,
      manifestUrl,
      appName: cloneName,
      appVersion: app.version || appInfo.version,
      originalBundleId,
      newBundleId,
      expiresAt: new Date(meta.expiresAt).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل التوقيع والتكرار" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONAL SIGN SECTION — subscriber uploads/URLs their own IPA files
// ═══════════════════════════════════════════════════════════════════════════════

const TEMP_DIR = path.join(process.cwd(), "uploads", "temp");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const SIGN_TTL_MS  = 6  * 60 * 60 * 1000; // 6 hours for signed files
const QUOTA_BYTES  = 4  * 1024 * 1024 * 1024; // 4 GB per day per subscriber

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB max per file
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".ipa")) {
      return cb(new Error("Only .ipa files are allowed"));
    }
    cb(null, true);
  },
});

function getDiskFreeBytes(): { freeBytes: number; totalBytes: number } {
  try {
    const out = execSync(`df -k ${process.cwd()} | tail -1`).toString().trim();
    const parts = out.split(/\s+/);
    const totalKB = parseInt(parts[1] || "0", 10);
    const availKB = parseInt(parts[3] || "0", 10);
    return { freeBytes: availKB * 1024, totalBytes: totalKB * 1024 };
  } catch {
    return { freeBytes: 0, totalBytes: 0 };
  }
}

async function getTodayUsedBytes(subscriberCode: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ total: sqlExpr<number>`coalesce(sum(file_size), 0)` })
    .from(signJobsTable)
    .where(
      sqlExpr`subscriber_code = ${subscriberCode} AND created_at >= ${startOfDay.toISOString()}`
    );
  return Number(rows[0]?.total ?? 0);
}

async function downloadUrlToFile(url: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    let written = 0;

    function get(u: string) {
      protocol.get(u, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`HTTP ${res.statusCode} — could not download file`));
        }
        res.on("data", (chunk) => { written += chunk.length; });
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(written); });
        file.on("error", reject);
        res.on("error", reject);
      }).on("error", reject);
    }
    get(url);
  });
}

async function getAndValidateSub(code: string) {
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.code, code));
  if (!sub) throw Object.assign(new Error("كود الاشتراك غير موجود / Subscription code not found"), { status: 404 });
  if (sub.isActive !== "true") throw Object.assign(new Error("الاشتراك غير فعّال / Subscription inactive"), { status: 403 });
  return sub;
}

async function performPersonalSign(jobId: string, inputPath: string) {
  const [job] = await db.select().from(signJobsTable).where(eq(signJobsTable.jobId, jobId));
  if (!job) return;

  await db.update(signJobsTable).set({ status: "processing" }).where(eq(signJobsTable.jobId, jobId));

  try {
    const { sub, group } = await getSubAndGroup(job.subscriberCode);

    const appInfo = readIpaInfo(inputPath);
    const token = randomHex(16);
    const outputPath = path.join(SIGNED_DIR, `${token}.ipa`);
    const dylibPath = getAntiRevokeDylibPath();

    await signIpa({
      p12Base64: group.p12Data!,
      p12Password: group.p12Password || "",
      mpBase64: group.mobileprovisionData!,
      inputPath,
      outputPath,
      bundleId:   job.customBundleId || undefined,
      bundleName: job.customName || undefined,
      dylibPaths: dylibPath ? [dylibPath] : undefined,
    });

    const expiresAt = new Date(Date.now() + SIGN_TTL_MS);
    const meta: TokenMeta = {
      appName:   job.customName    || appInfo.name,
      appVersion: appInfo.version,
      bundleId:  job.customBundleId || appInfo.bundleId,
      ipaPath:   outputPath,
      expiresAt: expiresAt.getTime(),
    };
    saveToken(token, meta);

    await db.update(signJobsTable).set({
      status: "done",
      originalName:     appInfo.name,
      originalBundleId: appInfo.bundleId,
      originalVersion:  appInfo.version,
      signedToken:   token,
      signedExpiresAt: expiresAt,
    }).where(eq(signJobsTable.jobId, jobId));
  } catch (err: any) {
    await db.update(signJobsTable).set({
      status: "error",
      errorMessage: err.message || "Unknown error",
    }).where(eq(signJobsTable.jobId, jobId));
  } finally {
    fs.rmSync(inputPath, { force: true });
  }
}

// ─── GET /api/sign/health ────────────────────────────────────────────────────
router.get("/sign/health", (_req, res): void => {
  const { freeBytes, totalBytes } = getDiskFreeBytes();
  res.json({
    freeBytes,
    totalBytes,
    freeGB:  Number((freeBytes  / 1024 ** 3).toFixed(1)),
    totalGB: Number((totalBytes / 1024 ** 3).toFixed(1)),
    usedPct: totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0,
  });
});

// ─── GET /api/sign/personal/quota?code=XXX ──────────────────────────────────
router.get("/sign/personal/quota", async (req, res): Promise<void> => {
  const code = ((req.query.code as string) || "").trim();
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  try {
    await getAndValidateSub(code);
    const usedBytes = await getTodayUsedBytes(code);
    res.json({
      usedBytes,
      limitBytes: QUOTA_BYTES,
      availableBytes: Math.max(0, QUOTA_BYTES - usedBytes),
      usedGB:  Number((usedBytes  / 1024 ** 3).toFixed(2)),
      limitGB: Number((QUOTA_BYTES / 1024 ** 3).toFixed(1)),
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── POST /api/sign/personal/analyze-url ─────────────────────────────────────
// Given a URL, fetch only the first chunk to read the IPA plist — or a size hint from headers
router.post("/sign/personal/analyze-url", async (req, res): Promise<void> => {
  const { url, code } = req.body as { url?: string; code?: string };
  if (!url || !code) { res.status(400).json({ error: "url and code required" }); return; }
  try {
    await getAndValidateSub(code);

    // Get file size from headers first (non-destructive)
    const headSize = await new Promise<number>((resolve) => {
      const protocol = url.startsWith("https") ? https : http;
      const req2 = protocol.request(url, { method: "HEAD" }, (r) => {
        resolve(parseInt(r.headers["content-length"] || "0", 10));
      });
      req2.on("error", () => resolve(0));
      req2.end();
    });

    // Download to temp to read plist info
    const tmpPath = path.join(TEMP_DIR, `analyze_${randomHex(8)}.ipa`);
    try {
      const downloaded = await downloadUrlToFile(url, tmpPath);
      const info = readIpaInfo(tmpPath);
      res.json({ ...info, fileSize: headSize || downloaded });
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || "Failed to analyze file" });
  }
});

// ─── POST /api/sign/personal/start-url ──────────────────────────────────────
// Async job: download URL then sign in background
router.post("/sign/personal/start-url", signLimiter, async (req, res): Promise<void> => {
  const { url, code, customName, customBundleId, fileSize } = req.body as {
    url?: string; code?: string; customName?: string; customBundleId?: string; fileSize?: number;
  };
  if (!url || !code) { res.status(400).json({ error: "url and code required" }); return; }
  try {
    await getAndValidateSub(code);
    const usedBytes = await getTodayUsedBytes(code);
    const fSize = Number(fileSize) || 0;
    if (usedBytes + fSize > QUOTA_BYTES) {
      res.status(429).json({ error: "تجاوزت الحصة اليومية (4 GB). حاول غداً." }); return;
    }

    const jobId = crypto.randomUUID();
    await db.insert(signJobsTable).values({
      jobId,
      subscriberCode: code,
      status: "pending",
      sourceType: "url",
      sourceUrl: url,
      customName: customName?.trim() || null,
      customBundleId: customBundleId?.trim() || null,
      fileSize: fSize,
    });

    res.json({ jobId, status: "pending" });

    // Run in background — download + sign
    setImmediate(async () => {
      const tmpPath = path.join(TEMP_DIR, `${jobId}.ipa`);
      try {
        await downloadUrlToFile(url, tmpPath);
        await performPersonalSign(jobId, tmpPath);
      } catch (err: any) {
        await db.update(signJobsTable).set({ status: "error", errorMessage: err.message }).where(eq(signJobsTable.jobId, jobId));
        fs.rmSync(tmpPath, { force: true });
      }
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── POST /api/sign/personal/upload ─────────────────────────────────────────
// Async job: multipart IPA upload then sign in background
router.post("/sign/personal/upload", signLimiter, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "IPA file required" }); return; }
  const code = req.body?.code as string;
  const customName = req.body?.customName as string;
  const customBundleId = req.body?.customBundleId as string;
  if (!code) { fs.rmSync(req.file.path, { force: true }); res.status(400).json({ error: "code required" }); return; }

  try {
    await getAndValidateSub(code);
    const usedBytes = await getTodayUsedBytes(code);
    if (usedBytes + req.file.size > QUOTA_BYTES) {
      fs.rmSync(req.file.path, { force: true });
      res.status(429).json({ error: "تجاوزت الحصة اليومية (4 GB). حاول غداً." }); return;
    }

    const jobId = crypto.randomUUID();
    await db.insert(signJobsTable).values({
      jobId,
      subscriberCode: code,
      status: "pending",
      sourceType: "upload",
      customName: customName?.trim() || null,
      customBundleId: customBundleId?.trim() || null,
      fileSize: req.file.size,
    });

    res.json({ jobId, status: "pending" });

    const tmpPath = req.file.path;
    setImmediate(() => performPersonalSign(jobId, tmpPath));
  } catch (err: any) {
    fs.rmSync(req.file!.path, { force: true });
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── GET /api/sign/personal/job/:jobId?code=XXX ─────────────────────────────
router.get("/sign/personal/job/:jobId", async (req, res): Promise<void> => {
  const { jobId } = req.params;
  const code = ((req.query.code as string) || "").trim();
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  try {
    const [job] = await db.select().from(signJobsTable)
      .where(eq(signJobsTable.jobId, jobId)).limit(1);
    if (!job || job.subscriberCode !== code) { res.status(404).json({ error: "Job not found" }); return; }

    let itmsUrl: string | null = null;
    if (job.status === "done" && job.signedToken) {
      const meta = loadToken(job.signedToken);
      if (meta) {
        const baseUrl = getBaseUrl(req);
        const manifestUrl = `${baseUrl}/api/sign/manifest/${job.signedToken}.plist`;
        itmsUrl = buildItmsUrl(baseUrl, manifestUrl);
      } else {
        // Token expired even though job says done — update DB
        await db.update(signJobsTable).set({ status: "error", errorMessage: "رابط التحميل انتهت صلاحيته" }).where(eq(signJobsTable.jobId, jobId));
      }
    }

    res.json({ ...job, itmsUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/sign/personal/history?code=XXX ────────────────────────────────
router.get("/sign/personal/history", async (req, res): Promise<void> => {
  const code = ((req.query.code as string) || "").trim();
  if (!code) { res.status(400).json({ error: "code required" }); return; }
  try {
    await getAndValidateSub(code);
    const jobs = await db.select().from(signJobsTable)
      .where(eq(signJobsTable.subscriberCode, code))
      .orderBy(desc(signJobsTable.createdAt))
      .limit(50);

    const now = Date.now();
    const withStatus = jobs.map(j => ({
      ...j,
      isExpired: j.signedExpiresAt ? new Date(j.signedExpiresAt).getTime() < now : true,
    }));

    res.json({ jobs: withStatus });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Dylib Cache Management
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/admin/dylibs/status ────────────────────────────────────────────
// Returns cache status for each dylib: cached, ETag, size, last checked
router.get("/admin/dylibs/status", adminAuth, (_req, res): void => {
  res.json({ dylibs: getDylibCacheStatus() });
});

// ─── POST /api/admin/dylibs/refresh ──────────────────────────────────────────
// Force-flush cache for one or all dylibs → next signing re-downloads from R2
// Body: { filename?: "antirevoke.dylib" | "mismari-store.dylib" }
//       omit filename to flush ALL
router.post("/admin/dylibs/refresh", adminAuth, async (req, res): Promise<void> => {
  try {
    const { filename } = req.body as { filename?: string };

    // Validate filename if provided
    const allowed = ["antirevoke.dylib", "mismari-store.dylib"];
    if (filename && !allowed.includes(filename)) {
      res.status(400).json({ error: `اسم الـ dylib غير صحيح. المسموح: ${allowed.join(", ")}` });
      return;
    }

    const { flushed } = flushDylibCache(filename);

    // Trigger re-download immediately in background
    for (const name of flushed) {
      const localPath = path.join(DYLIB_DIR, name);
      ensureDylib(name, localPath).catch(() => {});
    }

    res.json({
      success: true,
      flushed,
      message: flushed.length > 0
        ? `تم مسح الكاش وبدء تحديث: ${flushed.join(", ")}`
        : "لم يوجد كاش لمسحه",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
