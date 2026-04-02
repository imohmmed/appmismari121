// ═══════════════════════════════════════════════════════════════════════════════
// DYLIB CACHE MANAGER — ETag-based cache invalidation
// ───────────────────────────────────────────────────────────────────────────────
// Two separate dylibs:
//   antirevoke.dylib      → injected into USER APPS signed from the store
//   mismari-store.dylib   → injected into the STORE APP (Mismari+) itself
//
// Cache strategy:
//  1. On first use → download from R2, store ETag alongside the file
//  2. Every 5 min (per dylib) → HEAD request to R2 to compare ETag
//  3. If ETag changed → re-download automatically
//  4. Admin can force-flush cache via POST /api/admin/dylibs/refresh
// ═══════════════════════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

export const DYLIB_DIR             = path.join(process.cwd(), "uploads", "dylibs");
export const ANTIREVOKE_DYLIB_PATH = path.join(DYLIB_DIR, "antirevoke.dylib");
export const STORE_DYLIB_PATH      = path.join(DYLIB_DIR, "mismari-store.dylib");

const DYLIB_CHECK_INTERVAL = 5 * 60 * 1000; // 5 min between R2 ETag checks
const R2_DL = () => (process.env.R2_DL_DOMAIN || "https://dl.mismari.com");

fs.mkdirSync(DYLIB_DIR, { recursive: true });

/** In-memory: last successful ETag check timestamp per dylib filename */
const dylibLastCheck: Record<string, number> = {};

/** In-flight promises — prevents duplicate concurrent downloads */
const dylibDownloadLock: Record<string, Promise<void>> = {};

// ─── ETag helpers ─────────────────────────────────────────────────────────────

function etagFilePath(localPath: string): string { return localPath + ".etag"; }

function storedEtag(localPath: string): string | null {
  const p = etagFilePath(localPath);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim() : null;
}

function saveEtag(localPath: string, etag: string): void {
  fs.writeFileSync(etagFilePath(localPath), etag, "utf8");
}

/** HEAD request to R2 → returns current ETag or Last-Modified header, or null */
function fetchR2Etag(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proto = url.startsWith("https") ? https : http;
    const req = proto.request(url, { method: "HEAD" }, (res) => {
      resolve((res.headers["etag"] || res.headers["last-modified"] || null) as string | null);
      res.resume();
    });
    req.on("error", () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ─── Core download ────────────────────────────────────────────────────────────

/** Max dylib size: 50 MB — protects against accidental oversized R2 responses */
const MAX_DYLIB_BYTES = 50 * 1024 * 1024;

async function downloadDylib(url: string, localPath: string): Promise<string | null> {
  const tmpPath = localPath + ".tmp";

  return new Promise<string | null>((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file  = fs.createWriteStream(tmpPath);
    let etag: string | null = null;
    let settled = false;

    /** Call once — prevents reject/resolve from firing more than once */
    const fail = (e: Error) => {
      if (settled) return;
      settled = true;
      file.destroy();
      fs.rmSync(tmpPath, { force: true });
      reject(e);
    };

    proto.get(url, (res) => {
      if (!res.statusCode || res.statusCode !== 200) {
        // IMPORTANT: consume the body so the connection returns to the pool
        res.resume();
        return fail(new Error(`HTTP ${res.statusCode} from R2 (${url})`));
      }

      // Guard: reject if R2 claims file is larger than allowed limit
      const contentLength = parseInt(res.headers["content-length"] ?? "0", 10);
      if (contentLength > MAX_DYLIB_BYTES) {
        res.resume();
        return fail(new Error(`R2 Content-Length ${contentLength} exceeds ${MAX_DYLIB_BYTES} byte limit`));
      }

      etag = (res.headers["etag"] || res.headers["last-modified"] || null) as string | null;

      // Guard: count bytes received — reject if stream exceeds limit
      let received = 0;
      res.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_DYLIB_BYTES) {
          fail(new Error(`Download exceeded ${MAX_DYLIB_BYTES} byte limit (received ${received} bytes)`));
          res.destroy();
        }
      });

      res.pipe(file);
      file.on("finish", () => {
        if (settled) return;
        settled = true;
        file.close(() => resolve(etag));
      });
      file.on("error", (e) => fail(e));
      res.on("error",  (e) => fail(e));

    }).on("error", (e) => fail(e));

  }).then((etag) => {
    fs.renameSync(tmpPath, localPath);
    return etag;
  });
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/** Sentinel file: if <localPath>.disabled exists, auto-download is permanently suppressed */
function disabledFlagPath(localPath: string): string { return localPath + ".disabled"; }
export function isDylibDisabled(localPath: string): boolean {
  return fs.existsSync(disabledFlagPath(localPath));
}
export function disableDylib(localPath: string): void {
  // Delete the dylib and its etag, create the .disabled sentinel
  if (fs.existsSync(localPath)) fs.rmSync(localPath, { force: true });
  const etag = etagFilePath(localPath);
  if (fs.existsSync(etag)) fs.rmSync(etag, { force: true });
  fs.writeFileSync(disabledFlagPath(localPath), new Date().toISOString(), "utf8");
  console.log(`[dylib] 🚫 ${path.basename(localPath)} — disabled (won't auto-download)`);
}
export function enableDylib(localPath: string): void {
  const flag = disabledFlagPath(localPath);
  if (fs.existsSync(flag)) fs.rmSync(flag, { force: true });
  console.log(`[dylib] ✅ ${path.basename(localPath)} — re-enabled`);
}

/**
 * Ensure a dylib is present locally and up-to-date with R2.
 * - Missing locally → download
 * - ETag check interval elapsed → compare ETags, re-download if stale
 * - Concurrent calls for the same filename are deduplicated
 * - If .disabled sentinel exists → skip entirely
 */
export async function ensureDylib(filename: string, localPath: string): Promise<void> {
  // Deduplicate concurrent calls for the same dylib
  if (dylibDownloadLock[filename]) return dylibDownloadLock[filename];

  const doWork = async () => {
    // Admin disabled this dylib — do not download
    if (isDylibDisabled(localPath)) {
      if (fs.existsSync(localPath)) fs.rmSync(localPath, { force: true });
      return;
    }

    const url      = `${R2_DL()}/dylibs/${filename}`;
    const now      = Date.now();
    const lastCheck = dylibLastCheck[filename] ?? 0;
    const needsCheck = (now - lastCheck) > DYLIB_CHECK_INTERVAL;
    const fileExists = fs.existsSync(localPath);

    // Cache is fresh — skip R2 check entirely
    if (fileExists && !needsCheck) return;

    // Update the last-check timestamp regardless of outcome
    dylibLastCheck[filename] = now;

    if (fileExists && needsCheck) {
      // Compare ETag with R2 — only re-download if ETag changed or unavailable
      const remoteEtag = await fetchR2Etag(url);
      const localEtag  = storedEtag(localPath);

      if (remoteEtag && localEtag && remoteEtag === localEtag) {
        console.log(`[dylib] ${filename} — ETag match (${remoteEtag.slice(0, 16)}…), cache valid ✅`);
        return;
      }

      if (remoteEtag && localEtag) {
        // ETag changed — log old vs new before re-download
        console.log(`[dylib] ${filename} — ETag changed → refreshing ♻️`);
        console.log(`[dylib]   local : ${localEtag.slice(0, 16)}`);
        console.log(`[dylib]   remote: ${remoteEtag.slice(0, 16)}`);
      } else {
        // One or both ETags unavailable — re-download to be safe
        console.log(`[dylib] ${filename} — ETag unavailable, re-downloading to be safe…`);
      }
    } else if (!fileExists) {
      // First time — file never downloaded
      console.log(`[dylib] ${filename} — not cached, downloading from R2…`);
    }

    // Download
    try {
      const etag = await downloadDylib(url, localPath);
      if (etag) saveEtag(localPath, etag);
      const sizeKB = Math.round(fs.statSync(localPath).size / 1024);
      console.log(`[dylib] ✅ ${filename} ready (${sizeKB} KB, ETag: ${etag?.slice(0, 16) ?? "n/a"})`);
    } catch (e: any) {
      if (fs.existsSync(localPath)) {
        console.warn(`[dylib] ⚠️  Could not refresh ${filename}: ${e.message} — using cached version`);
      } else {
        console.error(`[dylib] ❌ Failed to download ${filename}: ${e.message}`);
      }
    }
  };

  dylibDownloadLock[filename] = doWork().finally(() => { delete dylibDownloadLock[filename]; });
  return dylibDownloadLock[filename];
}

/** Convenience: ensure antirevoke.dylib (for user apps) */
export async function ensureAppDylib(): Promise<void> {
  return ensureDylib("antirevoke.dylib", ANTIREVOKE_DYLIB_PATH);
}

/** Convenience: ensure mismari-store.dylib (for the store app) */
export async function ensureStoreDylib(): Promise<void> {
  return ensureDylib("mismari-store.dylib", STORE_DYLIB_PATH);
}

/** Returns local path if file exists, null otherwise */
export function getDylibPath(localPath: string): string | null {
  return fs.existsSync(localPath) ? localPath : null;
}

// ─── Cache management (admin) ─────────────────────────────────────────────────

/**
 * Force-flush local dylib cache.
 * - filename provided → flush just that dylib
 * - filename omitted  → flush all known dylibs
 */
export function flushDylibCache(filename?: string): { flushed: string[] } {
  const all = [
    { name: "antirevoke.dylib",    path: ANTIREVOKE_DYLIB_PATH },
    { name: "mismari-store.dylib", path: STORE_DYLIB_PATH },
  ];
  const targets = filename ? all.filter(d => d.name === filename) : all;

  const flushed: string[] = [];
  for (const t of targets) {
    if (fs.existsSync(t.path)) {
      fs.rmSync(t.path, { force: true });
      flushed.push(t.name);
    }
    const etag = etagFilePath(t.path);
    if (fs.existsSync(etag)) fs.rmSync(etag, { force: true });
    delete dylibLastCheck[t.name];
    console.log(`[dylib] 🗑️  Cache flushed: ${t.name}`);
  }
  return { flushed };
}

/** Returns status of all dylib caches (for admin dashboard) */
export function getDylibCacheStatus(): {
  name: string; cached: boolean; etag: string | null;
  sizeBytes: number; lastChecked: string | null;
}[] {
  const all = [
    { name: "antirevoke.dylib",    path: ANTIREVOKE_DYLIB_PATH },
    { name: "mismari-store.dylib", path: STORE_DYLIB_PATH },
  ];
  return all.map(item => {
    const cached    = fs.existsSync(item.path);
    const etag      = storedEtag(item.path);
    const lastCheck = dylibLastCheck[item.name];
    return {
      name:        item.name,
      cached,
      etag,
      sizeBytes:   cached ? fs.statSync(item.path).size : 0,
      lastChecked: lastCheck ? new Date(lastCheck).toISOString() : null,
    };
  });
}
