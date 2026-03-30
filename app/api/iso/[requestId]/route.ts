import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../../lib/server/admin-access";
import { writeAuditLog } from "../../../../lib/server/audit-log";
import { createAdminRemovalInboxNotice } from "../../../../lib/server/admin-content-removal";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import {
  deleteFirestoreDocument,
  getFirestoreDocument,
} from "../../../../lib/server/firestore-admin";
import { getIsoRequestWithCreator } from "../../../../lib/server/iso";

type IsoRequestRecord = {
  title?: string | null;
  createdByUid?: string | null;
};

type RequestBody = {
  message?: string;
};

function getSafeIsoError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("quota exceeded") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("\"code\": 429")
  ) {
    return "ISO is temporarily unavailable right now. Give it a moment and try again.";
  }

  return message || fallback;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing user token." }, { status: 401 });
    }

    await verifyFirebaseIdToken(idToken);
    const { requestId } = await context.params;
    const payload = await getIsoRequestWithCreator(requestId);

    if (!payload.request) {
      return NextResponse.json({ error: "ISO request not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: getSafeIsoError(error, "Could not load ISO request."),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const adminToken = await verifyAdminRequest(request.headers);
    const { requestId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as RequestBody;

    if (!requestId) {
      return NextResponse.json({ error: "Request id is required." }, { status: 400 });
    }

    const requestRecord = await getFirestoreDocument<IsoRequestRecord>(`isoRequests/${requestId}`);

    if (!requestRecord) {
      return NextResponse.json({ error: "ISO request not found." }, { status: 404 });
    }

    await deleteFirestoreDocument(`isoRequests/${requestId}`);

    if (requestRecord.createdByUid && requestRecord.createdByUid !== adminToken.sub) {
      await createAdminRemovalInboxNotice({
        userId: requestRecord.createdByUid,
        contentTypeLabel: "ISO post",
        contentTitle: requestRecord.title || "Untitled ISO Post",
        reason: body.message || "",
        adminUid: adminToken.sub,
        adminEmail: adminToken.email || null,
      });
    }

    await writeAuditLog({
      action: "iso.request.delete.admin",
      actor: { uid: adminToken.sub, email: adminToken.email },
      targetType: "isoRequest",
      targetId: requestId,
      status: "success",
      message: "Deleted ISO request as admin.",
      details: {
        title: requestRecord.title || null,
        adminMessage: body.message?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: getSafeIsoError(error, "Could not delete ISO request.") },
      { status: 500 }
    );
  }
}
