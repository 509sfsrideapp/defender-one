import { NextResponse } from "next/server";
import { writeAuditLog } from "../../../../../lib/server/audit-log";
import { getFirestoreDocument, patchFirestoreDocument } from "../../../../../lib/server/firestore-admin";
import { verifyFirebaseIdToken } from "../../../../../lib/server/firebase-auth";

type UserInboxPostRecord = {
  id: string;
  userId?: string;
  threadId?: string;
  title?: string;
  requiresResponse?: boolean;
  responseSubmittedAt?: string | null;
  readAt?: string | null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const { postId } = await context.params;
    const post = await getFirestoreDocument<UserInboxPostRecord>(`userInboxPosts/${postId}`);

    if (!post) {
      return NextResponse.json({ error: "Inbox post not found." }, { status: 404 });
    }

    if (post.userId !== decoded.sub) {
      return NextResponse.json({ error: "Unauthorized inbox read update." }, { status: 403 });
    }

    if (post.requiresResponse && !post.responseSubmittedAt) {
      return NextResponse.json({ ok: true, skipped: "response_required" });
    }

    if (post.readAt) {
      return NextResponse.json({ ok: true, skipped: "already_read" });
    }

    await patchFirestoreDocument(`userInboxPosts/${postId}`, {
      readAt: new Date(),
      readByUserId: decoded.sub,
    });

    await writeAuditLog({
      action: "inbox_post.mark_read",
      actor: { uid: decoded.sub, email: decoded.email },
      targetType: "userInboxPost",
      targetId: postId,
      status: "success",
      message: "User inbox post marked as read.",
      details: {
        title: post.title || null,
        threadId: post.threadId || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    await writeAuditLog({
      action: "inbox_post.mark_read",
      status: "failure",
      message: error instanceof Error ? error.message : "Could not update inbox read state.",
    }).catch((auditError) => {
      console.error("Audit log write failed", auditError);
    });
    return NextResponse.json({ error: "Could not update inbox read state." }, { status: 500 });
  }
}
