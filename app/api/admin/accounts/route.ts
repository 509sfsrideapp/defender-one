import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "../../../../lib/admin";
import { verifyAdminRequest } from "../../../../lib/server/admin-access";
import { writeAuditLog } from "../../../../lib/server/audit-log";
import { deleteFirestoreDocument, patchFirestoreDocument } from "../../../../lib/server/firestore-admin";
import { deleteUserOwnedDocuments } from "../../../../lib/server/account-cleanup";
import { deleteIdentityUser, setIdentityUserDisabled } from "../../../../lib/server/identity-toolkit";

type AdminAccountAction = "freeze" | "unfreeze" | "delete";

type RequestBody = {
  action?: AdminAccountAction;
  userId?: string;
  username?: string;
  email?: string;
};

export async function POST(request: NextRequest) {
  try {
    const adminToken = await verifyAdminRequest(request.headers);

    const body = (await request.json()) as RequestBody;
    const action = body.action;
    const userId = body.userId?.trim();
    const username = body.username?.trim();
    const targetEmail = body.email?.trim();

    if (!action || !userId) {
      return NextResponse.json({ error: "Action and userId are required." }, { status: 400 });
    }

    if (targetEmail && isAdminEmail(targetEmail)) {
      return NextResponse.json({ error: "The admin account cannot be frozen or deleted here." }, { status: 400 });
    }

    if (action === "freeze") {
      await setIdentityUserDisabled(userId, true);
      await patchFirestoreDocument(`users/${userId}`, {
        accountFrozen: true,
        frozenAt: new Date(),
        frozenByAdminEmail: adminToken.email || "admin",
        available: false,
      });
      await writeAuditLog({
        action: "admin.account.freeze",
        actor: { uid: adminToken.sub, email: adminToken.email },
        targetType: "user",
        targetId: userId,
        status: "success",
        message: `Froze account ${targetEmail || userId}.`,
        details: { email: targetEmail || null, username: username || null },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "unfreeze") {
      await setIdentityUserDisabled(userId, false);
      await patchFirestoreDocument(`users/${userId}`, {
        accountFrozen: false,
        frozenAt: null,
        frozenByAdminEmail: null,
        unfrozenAt: new Date(),
        unfrozenByAdminEmail: adminToken.email || "admin",
        available: false,
      });
      await writeAuditLog({
        action: "admin.account.unfreeze",
        actor: { uid: adminToken.sub, email: adminToken.email },
        targetType: "user",
        targetId: userId,
        status: "success",
        message: `Unfroze account ${targetEmail || userId}.`,
        details: { email: targetEmail || null, username: username || null },
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      await patchFirestoreDocument(`users/${userId}`, {
        accountFrozen: true,
        deletedAt: new Date(),
        deletedByAdminEmail: adminToken.email || "admin",
        available: false,
      });

      const cleanupResult = await deleteUserOwnedDocuments(userId);

      if (username) {
        await deleteFirestoreDocument(`usernames/${username.toLowerCase()}`);
      }

      await deleteIdentityUser(userId);
      await deleteFirestoreDocument(`users/${userId}`);
      await writeAuditLog({
        action: "admin.account.delete",
        actor: { uid: adminToken.sub, email: adminToken.email },
        targetType: "user",
        targetId: userId,
        status: "success",
        message: `Deleted account ${targetEmail || userId}.`,
        details: {
          email: targetEmail || null,
          username: username || null,
          cleanupDeletedCount: cleanupResult.totalDeleted,
          cleanupDeletedByCollection: cleanupResult.deletedByCollection,
          preservedCollections: ["rides"],
        },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error(error);
    await writeAuditLog({
      action: "admin.account.error",
      status: "failure",
      message: error instanceof Error ? error.message : "Could not manage that account.",
    }).catch((auditError) => {
      console.error("Audit log write failed", auditError);
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not manage that account." },
      { status: 500 }
    );
  }
}
