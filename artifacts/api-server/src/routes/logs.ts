import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { adminAuth } from "../middleware/adminAuth";

const router: IRouter = Router();

/* ── مساعد لإدراج سجل ──────────────────────────────────────────────────── */
export async function insertLog(entry: {
  type: "request" | "error" | "admin" | "auth" | "system";
  method?: string;
  url?: string;
  statusCode?: number;
  message?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
}) {
  try {
    await db.execute(sql`
      INSERT INTO site_logs (type, method, url, status_code, message, details, ip, user_agent, duration_ms)
      VALUES (
        ${entry.type},
        ${entry.method ?? null},
        ${entry.url ?? null},
        ${entry.statusCode ?? null},
        ${entry.message ?? null},
        ${entry.details ? JSON.stringify(entry.details) : null}::jsonb,
        ${entry.ip ?? null},
        ${entry.userAgent ?? null},
        ${entry.durationMs ?? null}
      )
    `);
  } catch {
    /* نتجاهل أخطاء التسجيل حتى لا تكسر الطلبات */
  }
}

/* ── Middleware لتسجيل كل طلب HTTP ─────────────────────────────────────── */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  const ua = req.headers["user-agent"] || "";

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const url = req.originalUrl?.split("?")[0] || req.url;
    const method = req.method;
    const status = res.statusCode;

    /* تجاهل طلبات الـ health check والأصول الثابتة */
    if (url === "/api/health" || url.startsWith("/admin/FilesIPA") || url.startsWith("/ipa/")) return;

    const type = status >= 500 ? "error" : status === 401 || status === 403 ? "auth" : "request";

    insertLog({ type, method, url, statusCode: status, ip, userAgent: ua, durationMs });
  });

  next();
}

/* ── API: جلب السجلات ──────────────────────────────────────────────────── */
router.get("/admin/logs", adminAuth, async (req, res): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const type = (req.query.type as string) || "";
    const search = (req.query.search as string) || "";

    let whereClause = sql`WHERE 1=1`;
    if (type) whereClause = sql`${whereClause} AND type = ${type}`;
    if (search) whereClause = sql`${whereClause} AND (url ILIKE ${`%${search}%`} OR message ILIKE ${`%${search}%`})`;

    const rows = await db.execute(sql`
      SELECT id, type, method, url, status_code, message, details, ip, user_agent, duration_ms, created_at
      FROM site_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM site_logs ${whereClause}
    `);

    res.json({
      logs: rows.rows,
      total: Number((countResult.rows[0] as any)?.total ?? 0),
      limit,
      offset,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── API: حذف السجلات ──────────────────────────────────────────────────── */
router.delete("/admin/logs", adminAuth, async (_req, res): Promise<void> => {
  try {
    await db.execute(sql`DELETE FROM site_logs`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
