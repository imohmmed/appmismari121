import { Router } from "express";
import plist from "plist";
import bplist from "bplist-parser";
import multer from "multer";
import AdmZip from "adm-zip";
import { inflateRawSync } from "zlib";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, appsTable } from "@workspace/db";
import { adminAuth } from "../middleware/adminAuth";
import { r2Upload, r2Delete, r2Url, urlToKey } from "../lib/r2";

const execFileAsync = promisify(execFile);
const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const IPA_DIR = path.join(UPLOADS_DIR, "FilesIPA", "IpaApp");
const ICONS_DIR = path.join(UPLOADS_DIR, "FilesIPA", "Icons");

fs.mkdirSync(IPA_DIR, { recursive: true });
fs.mkdirSync(ICONS_DIR, { recursive: true });

function randomHex(n = 24) {
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

function buildIpaUrl(_req: any, filename: string): string {
  return r2Url(`FilesIPA/IpaApp/${filename}`);
}

function buildIconUrl(_req: any, filename: string): string {
  return r2Url(`FilesIPA/Icons/${filename}`);
}

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

async function curlFetch(url: string, args: string[] = []): Promise<Buffer> {
  const { stdout } = await execFileAsync("curl", [
    "-L", "-s", "--max-time", "120",
    "--max-filesize", "500000000",
    ...args,
    url,
  ], { encoding: "buffer", maxBuffer: 500 * 1024 * 1024 });
  return Buffer.from(stdout);
}

async function getFileSize(url: string): Promise<number> {
  const { stdout } = await execFileAsync("curl", [
    "-L", "-s", "-I", "--max-time", "15", url,
  ], { encoding: "buffer" });
  const headers = stdout.toString();
  const match = headers.match(/content-length:\s*(\d+)/i);
  if (!match) throw new Error("لا يمكن تحديد حجم الملف");
  return parseInt(match[1], 10);
}

async function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
  return curlFetch(url, ["-H", `Range: bytes=${start}-${end}`]);
}

interface ZipEntry {
  name: string;
  localOffset: number;
  compSize: number;
  uncompSize: number;
  compression: number;
  isZip64: boolean;
  localOffset64?: bigint;
  compSize64?: bigint;
}

function parseCentralDirectory(buf: Buffer, partOffset: number): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) throw new Error("لم يتم العثور على EOCD في الملف");
  const eocd = buf.slice(eocdPos);
  const cdSize = eocd.readUInt32LE(12);
  const cdOffset = eocd.readUInt32LE(16);
  const cdStart = cdOffset - partOffset;
  let pos = cdStart;
  while (pos < cdStart + cdSize && pos < buf.length - 4) {
    if (buf[pos] !== 0x50 || buf[pos + 1] !== 0x4b || buf[pos + 2] !== 0x01 || buf[pos + 3] !== 0x02) break;
    const compression = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const fnLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.slice(pos + 46, pos + 46 + fnLen).toString();
    const isZip64 = localOffset === 0xffffffff || compSize === 0xffffffff;
    const entry: ZipEntry = { name, localOffset, compSize, uncompSize, compression, isZip64 };
    if (isZip64 && extraLen > 0) {
      const extra = buf.slice(pos + 46 + fnLen, pos + 46 + fnLen + extraLen);
      let ep = 0;
      while (ep < extra.length - 4) {
        const tag = extra.readUInt16LE(ep);
        const size = extra.readUInt16LE(ep + 2);
        if (tag === 0x0001) {
          let dp = ep + 4;
          if (uncompSize === 0xffffffff && dp + 8 <= extra.length) { entry.uncompSize = Number(extra.readBigUInt64LE(dp)); dp += 8; }
          if (compSize === 0xffffffff && dp + 8 <= extra.length) { entry.compSize64 = extra.readBigUInt64LE(dp); entry.compSize = Number(entry.compSize64); dp += 8; }
          if (localOffset === 0xffffffff && dp + 8 <= extra.length) { entry.localOffset64 = extra.readBigUInt64LE(dp); entry.localOffset = Number(entry.localOffset64); }
          break;
        }
        ep += 4 + size;
      }
    }
    entries.push(entry);
    pos += 46 + fnLen + extraLen + commentLen;
  }
  return entries;
}

async function extractEntryFromUrl(url: string, entry: ZipEntry): Promise<Buffer> {
  const offset = entry.localOffset;
  const headerBuf = await fetchRange(url, offset, offset + 1024);
  if (headerBuf[0] !== 0x50 || headerBuf[1] !== 0x4b) throw new Error("لم يتم العثور على Local File Header");
  const fnLen = headerBuf.readUInt16LE(26);
  const extraLen = headerBuf.readUInt16LE(28);
  const dataStart = offset + 30 + fnLen + extraLen;
  const dataEnd = dataStart + entry.compSize - 1;
  const compressedData = await fetchRange(url, dataStart, dataEnd);
  if (entry.compression === 0) return compressedData;
  if (entry.compression === 8) return inflateRawSync(compressedData);
  throw new Error(`ضغط غير مدعوم: ${entry.compression}`);
}

function iconToBase64(iconBuf: Buffer): string {
  return `data:image/png;base64,${iconBuf.toString("base64")}`;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

/** Read icon base-names from Info.plist (CFBundleIcons / CFBundleIconFiles). */
function getIconNamesFromPlist(plistData: Record<string, any>): string[] {
  const names: string[] = [];
  const tryAdd = (arr: any) => { if (Array.isArray(arr)) arr.forEach(n => names.push(String(n))); };
  const icons    = plistData["CFBundleIcons"] as any;
  tryAdd(icons?.CFBundlePrimaryIcon?.CFBundleIconFiles);
  const iconsIpad = plistData["CFBundleIcons~ipad"] as any;
  tryAdd(iconsIpad?.CFBundlePrimaryIcon?.CFBundleIconFiles);
  tryAdd(plistData["CFBundleIconFiles"]);
  return [...new Set(names)];
}

/** Build a prioritised list of PNG filenames to try (plist-based first, then fallbacks). */
function buildIconSearchList(plistIconNames: string[]): string[] {
  const list: string[] = [];
  const suffixes = ["@3x.png", "@2x.png", "~ipad@2x.png", ".png"];
  for (const base of plistIconNames) {
    const b = base.replace(/\.png$/i, "");
    for (const s of suffixes) list.push(`${b}${s}`);
  }
  list.push(
    "AppIcon60x60@3x.png", "AppIcon60x60@2x.png",
    "AppIcon76x76@2x~ipad.png", "AppIcon76x76@2x.png",
    "AppIcon57x57@2x.png", "AppIcon57x57.png",
    "Icon-60@3x.png", "Icon-60@2x.png",
    "AppIcon.png", "Icon.png", "Icon@2x.png",
    "AppIcon29x29@3x.png", "AppIcon29x29@2x.png",
    "AppIcon1024x1024@1x.png",
  );
  return [...new Set(list)];
}

async function extractIconFromUrl(
  url: string, entries: ZipEntry[], appFolder: string,
  plistIconNames: string[] = [],
): Promise<{ iconBuf: Buffer | null }> {
  const searchList = buildIconSearchList(plistIconNames);

  // 1. Try plist-specified names + standard names via range requests
  for (const iconName of searchList) {
    const iconEntry = entries.find(e => e.name === `${appFolder}/${iconName}`);
    if (iconEntry && iconEntry.compSize > 1000 && iconEntry.compSize < 2 * 1024 * 1024) {
      try { return { iconBuf: await extractEntryFromUrl(url, iconEntry) }; } catch { continue; }
    }
  }

  // 2. Any PNG directly inside the app bundle root (no subdirs), reasonable size
  const rootPngs = entries
    .filter(e => {
      const rel = e.name.replace(`${appFolder}/`, "");
      return e.name.startsWith(`${appFolder}/`) &&
        rel.endsWith(".png") &&
        !rel.includes("/") &&
        e.compSize > 1000 &&
        e.compSize < 2 * 1024 * 1024;
    })
    .sort((a, b) => b.compSize - a.compSize);   // largest first

  for (const entry of rootPngs) {
    try { return { iconBuf: await extractEntryFromUrl(url, entry) }; } catch { continue; }
  }

  return { iconBuf: null };
}

function extractIconFromZip(zip: AdmZip, appFolder: string, plistIconNames: string[] = []): Buffer | null {
  const searchList = buildIconSearchList(plistIconNames);
  const entries = zip.getEntries();

  // 1. Plist-specified names + standard names
  for (const iconName of searchList) {
    const e = entries.find(e => e.entryName === `${appFolder}/${iconName}`);
    if (e && e.getRealSize() > 1000) return e.getData();
  }

  // 2. Any PNG directly inside app bundle root, no subdirectory
  const rootPngs = entries
    .filter(e => {
      const rel = e.entryName.replace(`${appFolder}/`, "");
      return e.entryName.startsWith(`${appFolder}/`) &&
        rel.endsWith(".png") &&
        !rel.includes("/") &&
        e.getRealSize() > 1000 &&
        e.getRealSize() < 2 * 1024 * 1024;
    })
    .sort((a, b) => b.getRealSize() - a.getRealSize());   // largest first

  if (rootPngs.length > 0) return rootPngs[0].getData();
  return null;
}

// ─── POST /admin/ipa/parse-url ───────────────────────────────────────────────
// Reads only central directory + plist + icon (no full download). Does NOT save to disk.
router.post("/admin/ipa/parse-url", adminAuth, async (req, res): Promise<void> => {
  const { url } = req.body;
  if (!url || typeof url !== "string") { res.status(400).json({ error: "الرابط مطلوب" }); return; }
  if (!url.toLowerCase().endsWith(".ipa")) { res.status(400).json({ error: "الرابط يجب أن ينتهي بـ .ipa" }); return; }
  try {
    const totalSize = await getFileSize(url);
    if (!totalSize) throw new Error("لا يمكن تحديد حجم الملف");
    const tailSize = Math.min(3 * 1024 * 1024, totalSize);
    const tailBuf = await fetchRange(url, totalSize - tailSize, totalSize - 1);
    const entries = parseCentralDirectory(tailBuf, totalSize - tailSize);
    if (!entries.length) throw new Error("لم يتم العثور على ملفات داخل IPA");
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.name));
    if (!plistEntry) throw new Error("لم يتم العثور على Info.plist");
    const plistBuf = await extractEntryFromUrl(url, plistEntry);
    const plistData = parsePlistBuffer(plistBuf);
    const name: string = plistData["CFBundleDisplayName"] || plistData["CFBundleName"] || "";
    const bundleId: string = plistData["CFBundleIdentifier"] || "";
    const version: string = plistData["CFBundleShortVersionString"] || plistData["CFBundleVersion"] || "";
    const minOsVersion: string | null = plistData["MinimumOSVersion"] || null;
    const appFolder = plistEntry.name.replace("/Info.plist", "");
    const plistIconNames = getIconNamesFromPlist(plistData);
    const { iconBuf } = await extractIconFromUrl(url, entries, appFolder, plistIconNames);
    const iconBase64 = iconBuf ? `data:image/png;base64,${iconBuf.toString("base64")}` : null;
    const sizeMB = totalSize / (1024 * 1024);
    const sizeStr = sizeMB < 1 ? `${Math.round(totalSize / 1024)} KB` : sizeMB < 1024 ? `${Math.round(sizeMB)} MB` : `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    res.json({ name, bundleId, version, icon: iconBase64, sizeBytes: totalSize, size: sizeStr, minOsVersion, downloadUrl: url });
  } catch (err: any) {
    res.status(500).json({ error: `فشل تحليل الملف: ${err.message || "خطأ غير معروف"}` });
  }
});

// ─── POST /admin/ipa/upload-file ─────────────────────────────────────────────
// Full file upload: saves IPA + icon to disk. Returns server URLs.
router.post("/admin/ipa/upload-file", adminAuth, memUpload.single("file"), async (req: any, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "الملف مطلوب" }); return; }
  try {
    const buf = req.file.buffer;
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.entryName));
    if (!plistEntry) { res.status(422).json({ error: "لم يتم العثور على Info.plist داخل ملف IPA" }); return; }
    const plistData = parsePlistBuffer(plistEntry.getData());
    const name: string = plistData["CFBundleDisplayName"] || plistData["CFBundleName"] || "";
    const bundleId: string = plistData["CFBundleIdentifier"] || "";
    const version: string = plistData["CFBundleShortVersionString"] || plistData["CFBundleVersion"] || "";
    const minOsVersion: string | null = plistData["MinimumOSVersion"] || null;
    const appFolder = plistEntry.entryName.replace("/Info.plist", "");
    const plistIconNames = getIconNamesFromPlist(plistData);
    const sizeBytes = buf.length;
    const sizeMB = sizeBytes / (1024 * 1024);
    const size = sizeMB < 1 ? `${Math.round(sizeBytes / 1024)} KB` : `${Math.round(sizeMB)} MB`;

    const ipaFilename = `${randomHex(14)}.ipa`;
    const ipaFilePath = path.join(IPA_DIR, ipaFilename);
    fs.writeFileSync(ipaFilePath, buf);
    r2Upload(`FilesIPA/IpaApp/${ipaFilename}`, buf, "application/octet-stream").catch(() => {});
    const ipaUrl = buildIpaUrl(req, ipaFilename);
    const ipaRelPath = `FilesIPA/IpaApp/${ipaFilename}`;

    const iconBuf = extractIconFromZip(zip, appFolder, plistIconNames);
    const iconBase64 = iconBuf ? iconToBase64(iconBuf) : null;

    res.json({
      name, bundleId, version, minOsVersion, size, sizeBytes,
      downloadUrl: ipaUrl,
      ipaPath: ipaRelPath,
      icon: iconBase64,
      iconPath: null,
    });
  } catch (err: any) {
    res.status(422).json({ error: err.message || "فشل تحليل الملف" });
  }
});

// ─── POST /admin/ipa/save-from-url ───────────────────────────────────────────
// Download IPA from external URL, save it + icon to disk, return server URLs.
router.post("/admin/ipa/save-from-url", adminAuth, async (req: any, res): Promise<void> => {
  const { url } = req.body;
  if (!url || typeof url !== "string") { res.status(400).json({ error: "الرابط مطلوب" }); return; }
  if (!url.toLowerCase().endsWith(".ipa")) { res.status(400).json({ error: "الرابط يجب أن ينتهي بـ .ipa" }); return; }
  try {
    const totalSize = await getFileSize(url);
    const tailSize = Math.min(3 * 1024 * 1024, totalSize);
    const tailBuf = await fetchRange(url, totalSize - tailSize, totalSize - 1);
    const entries = parseCentralDirectory(tailBuf, totalSize - tailSize);
    if (!entries.length) throw new Error("لم يتم العثور على ملفات داخل IPA");
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.name));
    if (!plistEntry) throw new Error("لم يتم العثور على Info.plist");
    const plistBuf = await extractEntryFromUrl(url, plistEntry);
    const plistData = parsePlistBuffer(plistBuf);
    const name: string = plistData["CFBundleDisplayName"] || plistData["CFBundleName"] || "";
    const bundleId: string = plistData["CFBundleIdentifier"] || "";
    const version: string = plistData["CFBundleShortVersionString"] || plistData["CFBundleVersion"] || "";
    const minOsVersion: string | null = plistData["MinimumOSVersion"] || null;
    const appFolder = plistEntry.name.replace("/Info.plist", "");
    const plistIconNames = getIconNamesFromPlist(plistData);
    const sizeMB = totalSize / (1024 * 1024);
    const size = sizeMB < 1 ? `${Math.round(totalSize / 1024)} KB` : sizeMB < 1024 ? `${Math.round(sizeMB)} MB` : `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;

    const { stdout: ipaBuffer } = await execFileAsync("curl", ["-L", "-s", "--max-time", "120", url], { encoding: "buffer", maxBuffer: 500 * 1024 * 1024 });
    const ipaBuf = Buffer.from(ipaBuffer);
    const ipaFilename = `${randomHex(14)}.ipa`;
    const ipaFilePath = path.join(IPA_DIR, ipaFilename);
    fs.writeFileSync(ipaFilePath, ipaBuf);
    r2Upload(`FilesIPA/IpaApp/${ipaFilename}`, ipaBuf, "application/octet-stream").catch(() => {});
    const ipaUrl = buildIpaUrl(req, ipaFilename);
    const ipaRelPath = `FilesIPA/IpaApp/${ipaFilename}`;

    // Try fast range-based extraction first
    let { iconBuf } = await extractIconFromUrl(url, entries, appFolder, plistIconNames);

    // Fallback: use AdmZip on the full downloaded IPA (handles Assets.car-only apps
    // where icons aren't present as standalone PNGs in the central directory)
    if (!iconBuf) {
      try {
        const zip = new AdmZip(ipaBuf);
        iconBuf = extractIconFromZip(zip, appFolder, plistIconNames);
      } catch { /* ignore */ }
    }

    const iconBase64 = iconBuf ? iconToBase64(iconBuf) : null;

    res.json({
      name, bundleId, version, minOsVersion, size, sizeBytes: totalSize,
      downloadUrl: ipaUrl,
      ipaPath: ipaRelPath,
      icon: iconBase64,
      iconPath: null,
    });
  } catch (err: any) {
    res.status(500).json({ error: `فشل: ${err.message || "خطأ غير معروف"}` });
  }
});

// ─── Legacy parse-file (parse only, no disk save) ────────────────────────────
router.post("/admin/ipa/parse-file", adminAuth, memUpload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "الملف مطلوب" }); return; }
  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.entryName));
    if (!plistEntry) { res.status(422).json({ error: "لم يتم العثور على Info.plist داخل ملف IPA" }); return; }
    const plistData = parsePlistBuffer(plistEntry.getData());
    const name: string = plistData["CFBundleDisplayName"] || plistData["CFBundleName"] || "";
    const bundleId: string = plistData["CFBundleIdentifier"] || "";
    const version: string = plistData["CFBundleShortVersionString"] || plistData["CFBundleVersion"] || "";
    const minOsVersion: string | null = plistData["MinimumOSVersion"] || null;
    const appFolder = plistEntry.entryName.replace("/Info.plist", "");
    const iconBuf = extractIconFromZip(zip, appFolder);
    const iconBase64 = iconBuf ? `data:image/png;base64,${iconBuf.toString("base64")}` : null;
    const sizeBytes = req.file.buffer.length;
    const sizeMB = sizeBytes / (1024 * 1024);
    const size = sizeMB < 1 ? `${Math.round(sizeBytes / 1024)} KB` : `${Math.round(sizeMB)} MB`;
    res.json({ name, bundleId, version, icon: iconBase64, sizeBytes, size, minOsVersion, downloadUrl: null });
  } catch (err: any) {
    res.status(422).json({ error: err.message || "فشل تحليل الملف" });
  }
});

// ─── POST /admin/translate ───────────────────────────────────────────────────
router.post("/admin/translate", adminAuth, async (req, res): Promise<void> => {
  const { text, from, to } = req.body;
  if (!text || !from || !to) { res.status(400).json({ error: "text, from, to are required" }); return; }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const { stdout } = await execFileAsync("curl", ["-s", "--max-time", "10", url], { encoding: "buffer" });
    const data = JSON.parse(stdout.toString());
    if (data.responseStatus === 200) {
      res.json({ translated: data.responseData.translatedText });
    } else {
      res.status(500).json({ error: data.responseDetails || "فشل الترجمة" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل الاتصال" });
  }
});

// ─── POST /admin/apps/:id/clone ─────────────────────────────────────────────
router.post("/admin/apps/:id/clone", adminAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }

  const { name } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "اسم التطبيق الجديد مطلوب" }); return;
  }

  const [app] = await db.select().from(appsTable).where(eq(appsTable.id, id));
  if (!app) { res.status(404).json({ error: "التطبيق غير موجود" }); return; }
  if (!app.ipaPath) { res.status(400).json({ error: "ملف IPA غير موجود لهذا التطبيق" }); return; }

  const ipaFilename = path.basename(app.ipaPath);
  const ipaFilePath = path.join(IPA_DIR, ipaFilename);
  if (!fs.existsSync(ipaFilePath)) {
    res.status(400).json({ error: "ملف IPA غير موجود على السيرفر" }); return;
  }

  const rand = Math.floor(Math.random() * 90) + 10;
  const originalBundleId = app.bundleId || "com.app";
  const newBundleId = `${originalBundleId}.m${rand}`;
  const newName = name.trim();

  const buf = fs.readFileSync(ipaFilePath);
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();

  const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.entryName));
  if (!plistEntry) { res.status(422).json({ error: "لم يتم العثور على Info.plist داخل ملف IPA" }); return; }

  const plistData = parsePlistBuffer(plistEntry.getData());

  plistData["CFBundleIdentifier"] = newBundleId;
  plistData["CFBundleDisplayName"] = newName;
  plistData["CFBundleName"] = newName;

  if (Array.isArray(plistData["CFBundleURLTypes"])) {
    plistData["CFBundleURLTypes"] = plistData["CFBundleURLTypes"].map((urlType: any) => {
      if (Array.isArray(urlType["CFBundleURLSchemes"])) {
        urlType["CFBundleURLSchemes"] = urlType["CFBundleURLSchemes"].map((scheme: string) =>
          scheme.includes(originalBundleId) ? scheme.replace(originalBundleId, newBundleId) : scheme
        );
      }
      return urlType;
    });
  }

  zip.updateFile(plistEntry.entryName, Buffer.from(plist.build(plistData), "utf8"));

  const newIpaFilename = `clone_${randomHex(12)}.ipa`;
  const newIpaFilePath = path.join(IPA_DIR, newIpaFilename);
  zip.writeZip(newIpaFilePath);
  const cloneBuf = fs.readFileSync(newIpaFilePath);
  r2Upload(`FilesIPA/IpaApp/${newIpaFilename}`, cloneBuf, "application/octet-stream").catch(() => {});

  const newIpaUrl = buildIpaUrl(req, newIpaFilename);
  const newIpaRelPath = `FilesIPA/IpaApp/${newIpaFilename}`;

  const [newApp] = await db.insert(appsTable).values({
    name: newName,
    description: app.description,
    descriptionAr: app.descriptionAr,
    descriptionEn: app.descriptionEn,
    icon: app.icon,
    ipaPath: newIpaRelPath,
    iconPath: app.iconPath,
    categoryId: app.categoryId,
    tag: app.tag,
    version: app.version,
    bundleId: newBundleId,
    size: app.size,
    downloadUrl: newIpaUrl,
    downloads: 0,
    isFeatured: false,
    isHot: false,
    isHidden: false,
    isTestMode: false,
    status: "active",
  }).returning();

  res.json({ success: true, app: newApp, newBundleId });
});

// ─── Unsigned IPA (Mismari+) upload & status ──────────────────────────────────
const DATA_IPA_PATH = path.join(process.cwd(), "data", "Mismari-Plus-Unsigned.ipa");
const SERVE_IPA_PATH = path.join(process.cwd(), "uploads", "ipa", "Mismari-Plus-Unsigned.ipa");

const ipaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(path.join(process.cwd(), "uploads", "ipa"), { recursive: true });
      cb(null, path.join(process.cwd(), "uploads", "ipa"));
    },
    filename: (_req, _file, cb) => cb(null, "Mismari-Plus-Unsigned.ipa"),
  }),
  limits: { fileSize: 600 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith(".ipa") || file.mimetype === "application/octet-stream") cb(null, true);
    else cb(new Error("يجب أن يكون الملف بصيغة .ipa"));
  },
});

router.get("/admin/unsigned-ipa/status", adminAuth, (_req, res): void => {
  const serveExists = fs.existsSync(SERVE_IPA_PATH);
  const dataExists = fs.existsSync(DATA_IPA_PATH);
  const filePath = serveExists ? SERVE_IPA_PATH : (dataExists ? DATA_IPA_PATH : null);
  if (!filePath) {
    res.json({ exists: false });
    return;
  }
  const stat = fs.statSync(filePath);
  res.json({ exists: true, size: stat.size, updatedAt: stat.mtime.toISOString() });
});

router.post("/admin/unsigned-ipa/upload", adminAuth, ipaUpload.single("ipa"), (req: any, res): void => {
  if (!req.file) {
    res.status(400).json({ error: "لم يتم استلام الملف" });
    return;
  }
  // Also write to data/ for persistence
  try {
    fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    fs.copyFileSync(SERVE_IPA_PATH, DATA_IPA_PATH);
  } catch { /* data/ copy is best-effort */ }

  // Upload to R2
  r2Upload("ipa/Mismari-Plus-Unsigned.ipa", fs.readFileSync(SERVE_IPA_PATH), "application/octet-stream").catch(() => {});

  const stat = fs.statSync(SERVE_IPA_PATH);
  res.json({ success: true, size: stat.size, updatedAt: new Date().toISOString() });
});

export default router;
