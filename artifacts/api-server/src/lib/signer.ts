import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import plist from "plist";

const execFileAsync = promisify(execFile);

function findZsign(): string {
  const candidates = [
    path.join(process.cwd(), "bin", "zsign"),
    path.join(process.cwd(), "artifacts/api-server/bin", "zsign"),
    path.join(__dirname, "../../bin", "zsign"),
    "/home/runner/workspace/artifacts/api-server/bin/zsign",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}
export const ZSIGN_BIN = findZsign();
export const SIGNED_DIR = path.join(process.cwd(), "uploads", "Signed");

fs.mkdirSync(SIGNED_DIR, { recursive: true });

export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface TokenMeta {
  appName: string;
  appVersion: string;
  bundleId: string;
  ipaPath: string;
  expiresAt: number;
}

export function randomHex(n = 16) {
  return crypto.randomBytes(n).toString("hex");
}

/** Validate token contains only lowercase hex characters (matches output of randomHex) */
function validateToken(token: string): string {
  if (typeof token !== "string" || !/^[a-f0-9]{16,64}$/.test(token)) {
    throw new Error("Invalid token format");
  }
  return token;
}

export function saveToken(token: string, meta: TokenMeta) {
  const safeToken = validateToken(token);
  const metaPath = path.join(SIGNED_DIR, `${safeToken}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta));
}

export function loadToken(token: string): TokenMeta | null {
  let safeToken: string;
  try { safeToken = validateToken(token); } catch { return null; }
  const metaPath = path.join(SIGNED_DIR, `${safeToken}.json`);
  if (!fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as TokenMeta;
    if (Date.now() > meta.expiresAt) {
      fs.rmSync(metaPath, { force: true });
      fs.rmSync(path.join(SIGNED_DIR, `${safeToken}.ipa`), { force: true });
      return null;
    }
    return meta;
  } catch {
    return null;
  }
}

/**
 * Build MINIMAL safe entitlements from a mobileprovision.
 *
 * WHITELIST approach: keeps ONLY the 8 entitlements that are safe and needed
 * for React Native / Expo apps on sideloaded (development-signed) IPAs.
 *
 * Sideloading services generate provisioning profiles with 30–40 system-level
 * entitlements (system-extension.install, networkextension, kernel.extended,
 * healthkit, homekit, family-controls, etc.) that iOS AMFI immediately rejects
 * for apps not registered with Apple → black screen crash before any JS runs.
 *
 * Returns path to the entitlements.plist temp file (delete after signing).
 */
function buildCleanEntitlements(mpBase64: string, tmpDir: string): string | null {
  // Safe entitlements whitelist — everything else is stripped
  const SAFE_KEYS = new Set([
    "application-identifier",
    "keychain-access-groups",
    "com.apple.developer.team-identifier",
    "get-task-allow",
    "aps-environment",
    "com.apple.security.application-groups",
    "com.apple.developer.associated-domains",
    "com.apple.developer.push-to-talk",
  ]);

  try {
    const mpBuf = Buffer.from(mpBase64, "base64");
    const raw = mpBuf.toString("binary");
    const xmlMatch = raw.match(/<\?xml[\s\S]*?<\/plist>/);
    if (!xmlMatch) return null;

    const data = plist.parse(xmlMatch[0]) as Record<string, any>;
    const entitlements = data["Entitlements"] as Record<string, any> | undefined;
    if (!entitlements) return null;

    // Keep ONLY safe keys (whitelist)
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(entitlements)) {
      if (SAFE_KEYS.has(k)) clean[k] = v;
    }

    const removed = Object.keys(entitlements).filter(k => !SAFE_KEYS.has(k));
    if (removed.length > 0) {
      console.log(`[signer] stripped ${removed.length} dangerous entitlements:`, removed.slice(0, 5).join(", ") + (removed.length > 5 ? "..." : ""));
    }
    console.log("[signer] minimal entitlements:", Object.keys(clean).join(", "));

    const entPath = path.join(tmpDir, "entitlements.plist");
    fs.writeFileSync(entPath, plist.build(clean));
    return entPath;
  } catch (err: any) {
    console.warn("[signer] buildCleanEntitlements failed:", err?.message);
    return null; // fallback: zsign uses full profile entitlements
  }
}

export async function signIpa(opts: {
  p12Base64: string;
  p12Password: string;
  mpBase64: string;
  inputPath: string;
  outputPath: string;
  bundleId?: string;
  bundleName?: string;
  dylibPaths?: string[];
}): Promise<void> {
  const tmpDir = fs.mkdtempSync("/tmp/zsign-");
  try {
    const p12Path = path.join(tmpDir, "cert.p12");
    const mpPath = path.join(tmpDir, "app.mobileprovision");
    fs.writeFileSync(p12Path, Buffer.from(opts.p12Base64, "base64"));
    fs.writeFileSync(mpPath, Buffer.from(opts.mpBase64, "base64"));

    // ─── بناء entitlements نظيفة (بدون get-task-allow) ──────────────────────
    const entPath = buildCleanEntitlements(opts.mpBase64, tmpDir);

    const args: string[] = [
      "-k", p12Path,
      "-p", opts.p12Password || "",
      "-m", mpPath,
      "-o", opts.outputPath,
      "-z", "6",
    ];

    // مرّر الـ entitlements النظيفة إذا نجح استخراجها
    if (entPath) { args.push("-e", entPath); }

    if (opts.bundleId)   { args.push("-b", opts.bundleId); }
    if (opts.bundleName) { args.push("-n", opts.bundleName); }
    if (opts.dylibPaths) {
      for (const dp of opts.dylibPaths) {
        if (fs.existsSync(dp)) { args.push("-l", dp); }
      }
    }
    args.push(opts.inputPath);

    const result = await execFileAsync(ZSIGN_BIN, args, {
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.stdout) console.log("[zsign stdout]", result.stdout);
    if (result.stderr) console.error("[zsign stderr]", result.stderr);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Allowed base directories for file operations — nothing outside these is permitted */
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const ALLOWED_ROOTS = [UPLOADS_ROOT, "/tmp"];

/**
 * Verify a resolved path stays within allowed directories.
 * Throws if the path escapes uploads/ or /tmp (path traversal guard).
 */
function confineToAllowed(resolved: string): string {
  const normalized = path.normalize(resolved);
  const safe = ALLOWED_ROOTS.some(root =>
    normalized === root || normalized.startsWith(root + path.sep)
  );
  if (!safe) {
    // Log for audit — do not expose the actual path to callers
    console.error(`[SECURITY] Path traversal attempt blocked: ${normalized}`);
    throw new Error("Path traversal detected — access denied");
  }
  return normalized;
}

export function resolveLocalPath(storedPath: string): string {
  if (!storedPath) return "";
  if (storedPath.startsWith("http")) {
    const url = new URL(storedPath);
    const p = url.pathname;
    const storeMatch = p.match(/\/FilesIPA\/StoreIPA\/(.+)$/);
    if (storeMatch) return confineToAllowed(path.join(UPLOADS_ROOT, "StoreIPA", path.basename(storeMatch[1])));
    const appMatch = p.match(/\/FilesIPA\/IpaApp\/(.+)$/);
    if (appMatch) return confineToAllowed(path.join(UPLOADS_ROOT, "FilesIPA", "IpaApp", path.basename(appMatch[1])));
    const relMatch = p.match(/\/admin\/FilesIPA\/(.+)$/);
    if (relMatch) return confineToAllowed(path.join(UPLOADS_ROOT, "FilesIPA", path.basename(relMatch[1])));
    const signedStoreMatch = p.match(/\/(?:api\/)?admin\/signed-store\/(.+)$/);
    if (signedStoreMatch) return confineToAllowed(path.join(UPLOADS_ROOT, "SignedStore", path.basename(signedStoreMatch[1])));
    return confineToAllowed(path.join(UPLOADS_ROOT, path.basename(p)));
  }
  if (storedPath.startsWith("/admin/signed-store/") || storedPath.startsWith("/sign/store-files/")) {
    return confineToAllowed(path.join(UPLOADS_ROOT, "SignedStore", path.basename(storedPath)));
  }
  if (storedPath.startsWith("/admin/FilesIPA/StoreIPA/")) {
    return confineToAllowed(path.join(UPLOADS_ROOT, "StoreIPA", path.basename(storedPath)));
  }
  if (storedPath.startsWith("/admin/FilesIPA/IpaApp/")) {
    return confineToAllowed(path.join(UPLOADS_ROOT, "FilesIPA", "IpaApp", path.basename(storedPath)));
  }
  if (storedPath.startsWith("/")) {
    // Strip leading slash and sanitize — no directory traversal allowed
    const safe = path.basename(storedPath.slice(1));
    return confineToAllowed(path.join(UPLOADS_ROOT, safe));
  }
  // Relative path — basename only, confined to uploads/
  return confineToAllowed(path.join(UPLOADS_ROOT, path.basename(storedPath)));
}

export async function downloadToTemp(url: string): Promise<string> {
  const tmpPath = path.join("/tmp", `ipa-${randomHex(8)}.ipa`);
  const { default: https } = await import("https");
  const { default: http } = await import("http");
  const fs2 = await import("fs");

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs2.createWriteStream(tmpPath);

    function get(u: string) {
      protocol.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return get(res.headers.location!);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs2.rmSync(tmpPath, { force: true });
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(tmpPath); });
      }).on("error", (e) => { file.close(); fs2.rmSync(tmpPath, { force: true }); reject(e); });
    }
    get(url);
  });
}
