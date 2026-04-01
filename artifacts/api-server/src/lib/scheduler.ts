import { db, adminAuditLogsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import pino from "pino";

const logger = pino({ name: "scheduler" });

const ARCHIVES_DIR = path.join(process.cwd(), "archives");
fs.mkdirSync(ARCHIVES_DIR, { recursive: true });

/* ── أرشفة سجلات المحاسبة القديمة (أكثر من سنة) ── */
async function archiveOldAuditLogs() {
  try {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const oldLogs = await db
      .select()
      .from(adminAuditLogsTable)
      .where(lt(adminAuditLogsTable.createdAt, oneYearAgo));

    if (oldLogs.length === 0) {
      logger.info("Scheduler: لا توجد سجلات محاسبة قديمة للأرشفة");
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const archivePath = path.join(ARCHIVES_DIR, `audit-logs-${dateStr}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(oldLogs, null, 2), "utf-8");

    const deleted = await db
      .delete(adminAuditLogsTable)
      .where(lt(adminAuditLogsTable.createdAt, oneYearAgo));

    logger.info({ count: oldLogs.length, archive: archivePath }, "Scheduler: أُرشفت وحُذفت سجلات المحاسبة القديمة");
  } catch (err) {
    logger.error({ err }, "Scheduler: خطأ في أرشفة سجلات المحاسبة");
  }
}

/* ── حذف سجلات HTTP القديمة (أكثر من 6 أشهر) ── */
async function cleanOldRequestLogs() {
  try {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const result = await db.execute(
      sql`DELETE FROM site_logs WHERE created_at < ${sixMonthsAgo}`
    );

    logger.info({ deleted: (result as any).rowCount ?? 0 }, "Scheduler: حُذفت سجلات HTTP القديمة");
  } catch (err) {
    logger.error({ err }, "Scheduler: خطأ في حذف سجلات HTTP");
  }
}

/* ── التشغيل الدوري (كل 24 ساعة) ── */
export function startScheduler() {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const runAll = async () => {
    logger.info("Scheduler: بدء التنظيف اليومي...");
    await archiveOldAuditLogs();
    await cleanOldRequestLogs();
    logger.info("Scheduler: اكتمل التنظيف اليومي");
  };

  setTimeout(runAll, 60 * 1000);
  setInterval(runAll, MS_PER_DAY);

  logger.info("Scheduler: تم تسجيل مهام التنظيف (يومي)");
}
