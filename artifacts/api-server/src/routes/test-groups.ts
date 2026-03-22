/**
 * Test Certificate Group Routes
 * Handles p12 + mobileprovision parsing and test group management
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import plist from "plist";
import { db, groupsTable } from "@workspace/db";

const router: IRouter = Router();
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Parse .mobileprovision ──────────────────────────────────────────────────
function parseMobileprovision(buf: Buffer): Record<string, unknown> {
  // .mobileprovision is a CMS/PKCS7 DER-encoded binary
  // The embedded plist XML is plain text (not encrypted) — just signed
  const xmlStart = buf.indexOf(Buffer.from("<?xml"));
  const closingTag = Buffer.from("</plist>");
  const xmlEnd = buf.lastIndexOf(closingTag);
  if (xmlStart === -1 || xmlEnd === -1) throw new Error("ملف .mobileprovision غير صالح");

  const xmlStr = buf.slice(xmlStart, xmlEnd + closingTag.length).toString("utf8");
  return plist.parse(xmlStr) as Record<string, unknown>;
}

// ─── Parse .p12 using openssl ────────────────────────────────────────────────
function parseP12(buf: Buffer, password: string): { commonName: string; issuer: string; notBefore: string; notAfter: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mismari-cert-"));
  const p12Path = path.join(tmpDir, "cert.p12");
  const certPath = path.join(tmpDir, "cert.pem");

  try {
    fs.writeFileSync(p12Path, buf);

    // Export certificate as PEM (no key, no CA certs)
    execSync(
      `openssl pkcs12 -in "${p12Path}" -passin "pass:${password.replace(/"/g, '\\"')}" -nokeys -clcerts -out "${certPath}" 2>/dev/null`,
      { timeout: 10000 }
    );

    // Read certificate info
    const info = execSync(
      `openssl x509 -in "${certPath}" -noout -subject -issuer -dates 2>/dev/null`,
      { timeout: 5000, encoding: "utf8" }
    );

    const subjectMatch = info.match(/subject=(.+)/);
    const issuerMatch = info.match(/issuer=(.+)/);
    const notBeforeMatch = info.match(/notBefore=(.+)/);
    const notAfterMatch = info.match(/notAfter=(.+)/);

    const extractCN = (line: string) => {
      const m = line.match(/CN\s*=\s*([^,\n/]+)/);
      return m ? m[1].trim() : line.replace(/^(subject|issuer)=/, "").trim();
    };

    return {
      commonName: subjectMatch ? extractCN(subjectMatch[1]) : "—",
      issuer: issuerMatch ? extractCN(issuerMatch[1]) : "—",
      notBefore: notBeforeMatch ? notBeforeMatch[1].trim() : "—",
      notAfter: notAfterMatch ? notAfterMatch[1].trim() : "—",
    };
  } catch {
    throw new Error("كلمة مرور الشهادة غير صحيحة أو الملف تالف");
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── POST /admin/groups/test-analyze ─────────────────────────────────────────
// Analyzes p12 + mobileprovision files and returns extracted info
// Does NOT save to DB — for preview before saving
router.post(
  "/admin/groups/test-analyze",
  memUpload.fields([
    { name: "p12", maxCount: 1 },
    { name: "mobileprovision", maxCount: 1 },
  ]),
  async (req: any, res): Promise<void> => {
    const files = req.files as Record<string, Express.Multer.File[]>;
    const password = (req.body?.password as string) || "";

    if (!files?.p12?.[0] || !files?.mobileprovision?.[0]) {
      res.status(400).json({ error: "يرجى رفع كلا الملفين: .p12 و .mobileprovision" });
      return;
    }

    const result: Record<string, unknown> = {};

    // ── Parse mobileprovision ─────────────────────────────────────────────
    try {
      const mp = parseMobileprovision(files.mobileprovision[0].buffer);

      const udids = (mp.ProvisionedDevices as string[] | undefined) || [];
      const teamIds = (mp.TeamIdentifier as string[] | undefined) || [];
      const expirationDate = mp.ExpirationDate as Date | undefined;
      const entitlements = mp.Entitlements as Record<string, unknown> | undefined;

      result.mobileprovision = {
        name: mp.Name || "—",
        teamId: teamIds[0] || "—",
        teamName: mp.TeamName || "—",
        appIdName: mp.AppIDName || "—",
        bundleId: entitlements?.["application-identifier"]
          ? String(entitlements["application-identifier"]).replace(/^[A-Z0-9]+\./, "")
          : (mp.AppIDName || "—"),
        expirationDate: expirationDate ? new Date(expirationDate).toISOString() : null,
        udidCount: udids.length,
        udids: udids,
        entitlements: {
          pushNotifications: !!(entitlements?.["aps-environment"]),
          iCloud: !!(entitlements?.["com.apple.developer.icloud-container-identifiers"]),
          groupContainers: !!(entitlements?.["com.apple.security.application-groups"]),
          appGroups: (entitlements?.["com.apple.security.application-groups"] as string[] | undefined) || [],
          apsEnvironment: entitlements?.["aps-environment"] || null,
        },
        isWildcard: String(mp.AppIDName || "").includes("*") ||
          String(entitlements?.["application-identifier"] || "").endsWith(".*"),
        creationDate: mp.CreationDate ? new Date(mp.CreationDate as Date).toISOString() : null,
        platform: mp.Platform,
      };
    } catch (e) {
      result.mobileprovisionError = (e as Error).message;
    }

    // ── Parse p12 ─────────────────────────────────────────────────────────
    try {
      result.p12 = parseP12(files.p12[0].buffer, password);
    } catch (e) {
      result.p12Error = (e as Error).message;
    }

    res.json(result);
  }
);

// ─── POST /admin/groups/test-create ──────────────────────────────────────────
// Saves a test certificate group to the database
router.post(
  "/admin/groups/test-create",
  memUpload.fields([
    { name: "p12", maxCount: 1 },
    { name: "mobileprovision", maxCount: 1 },
  ]),
  async (req: any, res): Promise<void> => {
    const files = req.files as Record<string, Express.Multer.File[]>;
    const {
      certName,
      password,
      certCommonName,
      teamId,
      teamName,
      certExpiresAt,
      bundleId,
      provisionName,
      udids,
    } = req.body as Record<string, string>;

    if (!certName?.trim()) {
      res.status(400).json({ error: "اسم المجموعة مطلوب" });
      return;
    }

    try {
      const existing = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.certName, certName.trim()));
      if (existing.length > 0) {
        res.status(409).json({ error: "اسم المجموعة موجود مسبقاً" });
        return;
      }

      let udidsList: string[] = [];
      try { udidsList = JSON.parse(udids || "[]"); } catch { /* ignore */ }

      const [group] = await db.insert(groupsTable).values({
        certName: certName.trim(),
        groupType: "test_certificate",
        issuerId: "",
        keyId: "",
        privateKey: "",
        certCommonName: certCommonName?.trim() || null,
        teamId: teamId?.trim() || null,
        teamName: teamName?.trim() || null,
        certExpiresAt: certExpiresAt || null,
        bundleId: bundleId?.trim() || null,
        provisionName: provisionName?.trim() || null,
        provisionedUdids: JSON.stringify(udidsList),
        provisionedUdidCount: udidsList.length,
        p12Data: files?.p12?.[0] ? files.p12[0].buffer.toString("base64") : null,
        p12Password: password || null,
        mobileprovisionData: files?.mobileprovision?.[0]
          ? files.mobileprovision[0].buffer.toString("base64")
          : null,
      }).returning();

      res.status(201).json({ group });
    } catch (err) {
      console.error("test-create error:", err);
      res.status(500).json({ error: "حدث خطأ أثناء الحفظ" });
    }
  }
);

// ─── GET /admin/groups/:id/provision-udids ────────────────────────────────────
// Returns list of UDIDs from the saved mobileprovision
router.get("/admin/groups/:id/provision-udids", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  try {
    const [group] = await db.select({ provisionedUdids: groupsTable.provisionedUdids }).from(groupsTable).where(eq(groupsTable.id, id));
    if (!group) { res.status(404).json({ error: "Not found" }); return; }
    let udids: string[] = [];
    try { udids = JSON.parse(group.provisionedUdids || "[]"); } catch { /* ignore */ }
    res.json({ udids });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
