import { Router } from "express";
import plist from "plist";
import multer from "multer";
import AdmZip from "adm-zip";
import { inflateRawSync } from "zlib";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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

function buildIpaUrl(req: any, filename: string): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost";
  return `${proto}://${host}/admin/FilesIPA/IpaApp/${filename}`;
}

function buildIconUrl(req: any, filename: string): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost";
  return `${proto}://${host}/admin/FilesIPA/Icons/${filename}`;
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

function saveIconBuffer(iconBuf: Buffer): { iconFilename: string; iconPath: string } {
  const iconFilename = `${randomHex(12)}.png`;
  const iconPath = path.join(ICONS_DIR, iconFilename);
  fs.writeFileSync(iconPath, iconBuf);
  return { iconFilename, iconPath };
}

async function extractIconFromUrl(url: string, entries: ZipEntry[], appFolder: string): Promise<{ iconBuf: Buffer | null }> {
  const iconNames = [
    "AppIcon60x60@3x.png", "AppIcon60x60@2x.png", "AppIcon76x76@2x~ipad.png",
    "AppIcon76x76@2x.png", "AppIcon57x57@2x.png", "Icon-60@3x.png", "Icon-60@2x.png",
    "AppIcon.png", "Icon.png",
  ];
  for (const iconName of iconNames) {
    const iconEntry = entries.find(e => e.name === `${appFolder}/${iconName}`);
    if (iconEntry && iconEntry.compSize < 2 * 1024 * 1024) {
      try { return { iconBuf: await extractEntryFromUrl(url, iconEntry) }; } catch { continue; }
    }
  }
  const anyIcon = entries.find(e => e.name.startsWith(`${appFolder}/AppIcon`) && e.name.endsWith(".png") && e.compSize < 2 * 1024 * 1024);
  if (anyIcon) {
    try { return { iconBuf: await extractEntryFromUrl(url, anyIcon) }; } catch {}
  }
  return { iconBuf: null };
}

function extractIconFromZip(zip: AdmZip, appFolder: string): Buffer | null {
  const iconNames = [
    "AppIcon60x60@3x.png", "AppIcon60x60@2x.png", "AppIcon76x76@2x~ipad.png",
    "AppIcon76x76@2x.png", "AppIcon57x57@2x.png", "Icon-60@3x.png", "Icon-60@2x.png",
    "AppIcon.png", "Icon.png",
  ];
  const entries = zip.getEntries();
  for (const iconName of iconNames) {
    const e = entries.find(e => e.entryName === `${appFolder}/${iconName}`);
    if (e) return e.getData();
  }
  const anyIcon = entries.find(e => e.entryName.startsWith(`${appFolder}/AppIcon`) && e.entryName.endsWith(".png"));
  return anyIcon ? anyIcon.getData() : null;
}

// ─── POST /admin/ipa/parse-url ───────────────────────────────────────────────
// Reads only central directory + plist + icon (no full download). Does NOT save to disk.
router.post("/admin/ipa/parse-url", async (req, res): Promise<void> => {
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
    const plistData = plist.parse(plistBuf.toString("utf8")) as Record<string, any>;
    const name: string = plistData["CFBundleDisplayName"] || plistData["CFBundleName"] || "";
    const bundleId: string = plistData["CFBundleIdentifier"] || "";
    const version: string = plistData["CFBundleShortVersionString"] || plistData["CFBundleVersion"] || "";
    const minOsVersion: string | null = plistData["MinimumOSVersion"] || null;
    const appFolder = plistEntry.name.replace("/Info.plist", "");
    const { iconBuf } = await extractIconFromUrl(url, entries, appFolder);
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
router.post("/admin/ipa/upload-file", memUpload.single("file"), async (req: any, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "الملف مطلوب" }); return; }
  try {
    const buf = req.file.buffer;
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.entryName));
    if (!plistEntry) { res.status(422).json({ error: "لم يتم العثور على Info.plist داخل ملف IPA" }); return; }
    const plistData = plist.parse(plistEntry.getData().toString("utf8")) as Record<string, any>;
    const name: string = plistData["CFBundleDisplayName"] || plistData["CFBundleName"] || "";
    const bundleId: string = plistData["CFBundleIdentifier"] || "";
    const version: string = plistData["CFBundleShortVersionString"] || plistData["CFBundleVersion"] || "";
    const minOsVersion: string | null = plistData["MinimumOSVersion"] || null;
    const appFolder = plistEntry.entryName.replace("/Info.plist", "");
    const sizeBytes = buf.length;
    const sizeMB = sizeBytes / (1024 * 1024);
    const size = sizeMB < 1 ? `${Math.round(sizeBytes / 1024)} KB` : `${Math.round(sizeMB)} MB`;

    const ipaFilename = `${randomHex(14)}.ipa`;
    const ipaFilePath = path.join(IPA_DIR, ipaFilename);
    fs.writeFileSync(ipaFilePath, buf);
    const ipaUrl = buildIpaUrl(req, ipaFilename);
    const ipaRelPath = `/admin/FilesIPA/IpaApp/${ipaFilename}`;

    let iconUrl: string | null = null;
    let iconRelPath: string | null = null;
    const iconBuf = extractIconFromZip(zip, appFolder);
    if (iconBuf) {
      const { iconFilename, iconPath } = saveIconBuffer(iconBuf);
      iconUrl = buildIconUrl(req, iconFilename);
      iconRelPath = `/admin/FilesIPA/Icons/${iconFilename}`;
      fs.writeFileSync(iconPath, iconBuf);
    }

    res.json({
      name, bundleId, version, minOsVersion, size, sizeBytes,
      downloadUrl: ipaUrl,
      ipaPath: ipaRelPath,
      icon: iconUrl,
      iconPath: iconRelPath,
    });
  } catch (err: any) {
    res.status(422).json({ error: err.message || "فشل تحليل الملف" });
  }
});

// ─── POST /admin/ipa/save-from-url ───────────────────────────────────────────
// Download IPA from external URL, save it + icon to disk, return server URLs.
router.post("/admin/ipa/save-from-url", async (req: any, res): Promise<void> => {
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
    const plistData = plist.parse(plistBuf.toString("utf8")) as Record<string, any>;
    const name: string = plistData["CFBundleDisplayName"] || plistData["CFBundleName"] || "";
    const bundleId: string = plistData["CFBundleIdentifier"] || "";
    const version: string = plistData["CFBundleShortVersionString"] || plistData["CFBundleVersion"] || "";
    const minOsVersion: string | null = plistData["MinimumOSVersion"] || null;
    const appFolder = plistEntry.name.replace("/Info.plist", "");
    const sizeMB = totalSize / (1024 * 1024);
    const size = sizeMB < 1 ? `${Math.round(totalSize / 1024)} KB` : sizeMB < 1024 ? `${Math.round(sizeMB)} MB` : `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;

    const { stdout: ipaBuffer } = await execFileAsync("curl", ["-L", "-s", "--max-time", "120", url], { encoding: "buffer", maxBuffer: 500 * 1024 * 1024 });
    const ipaBuf = Buffer.from(ipaBuffer);
    const ipaFilename = `${randomHex(14)}.ipa`;
    const ipaFilePath = path.join(IPA_DIR, ipaFilename);
    fs.writeFileSync(ipaFilePath, ipaBuf);
    const ipaUrl = buildIpaUrl(req, ipaFilename);
    const ipaRelPath = `/admin/FilesIPA/IpaApp/${ipaFilename}`;

    let iconUrl: string | null = null;
    let iconRelPath: string | null = null;
    const { iconBuf } = await extractIconFromUrl(url, entries, appFolder);
    if (iconBuf) {
      const { iconFilename, iconPath } = saveIconBuffer(iconBuf);
      iconUrl = buildIconUrl(req, iconFilename);
      iconRelPath = `/admin/FilesIPA/Icons/${iconFilename}`;
      fs.writeFileSync(iconPath, iconBuf);
    }

    res.json({
      name, bundleId, version, minOsVersion, size, sizeBytes: totalSize,
      downloadUrl: ipaUrl,
      ipaPath: ipaRelPath,
      icon: iconUrl,
      iconPath: iconRelPath,
    });
  } catch (err: any) {
    res.status(500).json({ error: `فشل: ${err.message || "خطأ غير معروف"}` });
  }
});

// ─── Legacy parse-file (parse only, no disk save) ────────────────────────────
router.post("/admin/ipa/parse-file", memUpload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "الملف مطلوب" }); return; }
  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const plistEntry = entries.find(e => /^Payload\/[^/]+\.app\/Info\.plist$/.test(e.entryName));
    if (!plistEntry) { res.status(422).json({ error: "لم يتم العثور على Info.plist داخل ملف IPA" }); return; }
    const plistData = plist.parse(plistEntry.getData().toString("utf8")) as Record<string, any>;
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
router.post("/admin/translate", async (req, res): Promise<void> => {
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

export default router;
