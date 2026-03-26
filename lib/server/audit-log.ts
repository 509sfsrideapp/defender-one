import { createFirestoreDocument } from "./firestore-admin";

type AuditActor = {
  uid?: string | null;
  email?: string | null;
};

type AuditLogInput = {
  action: string;
  actor?: AuditActor;
  targetType?: string;
  targetId?: string;
  status?: "success" | "failure" | "info";
  message?: string;
  details?: Record<string, unknown>;
};

export async function writeAuditLog({
  action,
  actor,
  targetType = "system",
  targetId = "",
  status = "info",
  message = "",
  details = {},
}: AuditLogInput) {
  await createFirestoreDocument("auditLogs", {
    action,
    actorUid: actor?.uid || null,
    actorEmail: actor?.email || null,
    targetType,
    targetId,
    status,
    message,
    details,
    createdAt: new Date(),
  });
}
