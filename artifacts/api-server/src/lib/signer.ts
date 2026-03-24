import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

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

export function saveToken(token: string, meta: TokenMeta) {
  const metaPath = path.join(SIGNED_DIR, `${token}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta));
}

export function loadToken(token: string): TokenMeta | null {
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

export async function signIpa(opts: {
  p12Base64: string;
  p12Password: string;
  mpBase64: string;
  inputPath: string;
  outputPath: string;
  bundleId?: string;
  bundleName?: string;
}): Promise<void> {
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

export function resolveLocalPath(storedPath: string): string {
  if (!storedPath) return "";
  if (storedPath.startsWith("http")) {
    const url = new URL(storedPath);
    const p = url.pathname;
    const storeMatch = p.match(/\/FilesIPA\/StoreIPA\/(.+)$/);
    if (storeMatch) return path.join(process.cwd(), "uploads", "StoreIPA", storeMatch[1]);
    const appMatch = p.match(/\/FilesIPA\/IpaApp\/(.+)$/);
    if (appMatch) return path.join(process.cwd(), "uploads", "FilesIPA", "IpaApp", appMatch[1]);
    const relMatch = p.match(/\/admin\/FilesIPA\/(.+)$/);
    if (relMatch) return path.join(process.cwd(), "uploads", "FilesIPA", relMatch[1]);
    return path.join(process.cwd(), "uploads", path.basename(p));
  }
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
