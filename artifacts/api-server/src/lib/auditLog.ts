import { Request } from "express";
import { db, adminAuditLogsTable } from "@workspace/db";

export type AuditAction =
  | "LOGIN"
  | "CREATE_APP" | "UPDATE_APP" | "DELETE_APP"
  | "CREATE_CATEGORY" | "UPDATE_CATEGORY" | "DELETE_CATEGORY"
  | "CREATE_PLAN" | "UPDATE_PLAN" | "DELETE_PLAN"
  | "CREATE_SUBSCRIPTION" | "UPDATE_SUBSCRIPTION" | "DELETE_SUBSCRIPTION" | "BULK_DELETE_SUBSCRIPTIONS"
  | "CREATE_ADMIN" | "UPDATE_ADMIN" | "DELETE_ADMIN"
  | "UPDATE_SETTINGS"
  | "UPLOAD_BANNER"
  | "SEND_NOTIFICATION" | "DELETE_NOTIFICATION"
  | "UPLOAD_DYLIB" | "DELETE_DYLIB"
  | "SIGN_ALL_GROUPS" | "DELETE_GROUP" | "CREATE_GROUP" | "UPDATE_GROUP"
  | "ADD_BALANCE" | "DELETE_REVIEW"
  | "AI_TOGGLE_SUBSCRIPTION";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

export async function auditLog(
  req: Request,
  action: AuditAction,
  resource: string,
  resourceId?: string | number | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = (req as any).admin as { adminId?: number; username?: string } | undefined;
    const adminId    = admin?.adminId    ?? null;
    const adminUsername = admin?.username ?? "unknown";

    await db.insert(adminAuditLogsTable).values({
      adminId,
      adminUsername,
      action,
      resource,
      resourceId: resourceId != null ? String(resourceId) : null,
      details:    details ? JSON.stringify(details) : null,
      ipAddress:  getClientIp(req),
    });
  } catch (err) {
    // Never let audit logging crash the main flow
    console.error("[auditLog] failed:", err);
  }
}
