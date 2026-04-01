import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function getSetting(key: string): Promise<string> {
  try {
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    return rows[0]?.value || "";
  } catch { return ""; }
}

const ACTION_LABELS: Record<string, string> = {
  DELETE_ADMIN:    "🔴 حذف مشرف",
  CREATE_ADMIN:    "🟡 إضافة مشرف جديد",
  UPDATE_ADMIN:    "🟠 تعديل مشرف",
  UPLOAD_DYLIB:    "⚠️ رفع ملف ديناميكي",
  DELETE_DYLIB:    "🗑 حذف ملف ديناميكي",
  UPDATE_SETTINGS: "⚙️ تعديل إعدادات النظام",
};

export async function sendSecurityAlert(
  action: string,
  adminUsername: string,
  ipAddress: string,
  extraDetails?: string
): Promise<void> {
  try {
    const [token, ownerChatId] = await Promise.all([
      getSetting("telegram_bot_token"),
      getSetting("telegram_owner_chat_id"),
    ]);
    if (!token || !ownerChatId) return;

    const label = ACTION_LABELS[action] || `⚡ ${action}`;
    const now = new Date().toLocaleString("ar-IQ", {
      hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit",
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    const lines = [
      `🔐 *تنبيه أمني — مسماري+*`,
      ``,
      `الإجراء: *${label}*`,
      `المشرف: \`${adminUsername}\``,
      `IP: \`${ipAddress || "غير معروف"}\``,
      extraDetails ? `التفاصيل: ${extraDetails}` : null,
      `الوقت: ${now}`,
    ].filter(Boolean).join("\n");

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ownerChatId,
        text: lines,
        parse_mode: "Markdown",
      }),
    });
  } catch { /* صامت — لا نوقف الإجراءات بسبب خطأ في التنبيهات */ }
}
