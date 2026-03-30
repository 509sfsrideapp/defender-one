import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../../lib/server/admin-access";
import { writeAuditLog } from "../../../../lib/server/audit-log";
import { createUserInboxPostAndMaybeNotify } from "../../../../lib/server/user-notification-settings";

type RequestBody = {
  userId?: string;
  title?: string;
  body?: string;
};

export async function POST(request: NextRequest) {
  try {
    const adminToken = await verifyAdminRequest(request.headers);
    const body = (await request.json()) as RequestBody;
    const userId = body.userId?.trim();
    const title = body.title?.trim();
    const messageBody = body.body?.trim();

    if (!userId || !title || !messageBody) {
      return NextResponse.json({ error: "userId, title, and body are required." }, { status: 400 });
    }

    await createUserInboxPostAndMaybeNotify({
      userId,
      threadId: "admin",
      senderLabel: "Admin",
      senderType: "admin",
      title,
      body: messageBody,
      createdByUid: adminToken.sub,
      createdByEmail: adminToken.email || null,
      link: "/inbox/admin",
      origin: new URL(request.url).origin,
    });

    await writeAuditLog({
      action: "admin.account.message",
      actor: { uid: adminToken.sub, email: adminToken.email },
      targetType: "user",
      targetId: userId,
      status: "success",
      message: `Sent admin inbox message to ${userId}.`,
      details: {
        title,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    await writeAuditLog({
      action: "admin.account.message",
      status: "failure",
      message: error instanceof Error ? error.message : "Could not send admin inbox message.",
    }).catch((auditError) => {
      console.error("Audit log write failed", auditError);
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send admin inbox message." },
      { status: 500 }
    );
  }
}
