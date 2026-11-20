import "server-only";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditAction = "create" | "update" | "delete" | "status" | "assign" | "note" | "reset" | "upload" | "login" | "signout";

/**
 * Records an admin change for /admin/activity. Never throws — a failed
 * log entry must not undo or block the change itself.
 */
export async function audit(userId: number | null, action: AuditAction, entity: string, entityId: string | number | null, summary: string) {
  try {
    await getDb()
      .insert(auditLog)
      .values({ userId, action, entity, entityId: entityId === null ? null : String(entityId).slice(0, 120), summary: summary.slice(0, 300) });
  } catch (err) {
    console.error("[audit] could not record entry", err);
  }
}
