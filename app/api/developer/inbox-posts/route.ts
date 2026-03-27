import { NextRequest, NextResponse } from "next/server";
import { createFirestoreDocument } from "../../../../lib/server/firestore-admin";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import { writeAuditLog } from "../../../../lib/server/audit-log";

const DEVELOPER_COOKIE_NAME = "developer_access";

type RequestBody = {
  threadId?: "dev";
  title?: string;
  body?: string;
  imageUrl?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const accessCookie = request.cookies.get(DEVELOPER_COOKIE_NAME);

    if (accessCookie?.value !== "granted") {
      return NextResponse.json({ error: "Developer access required." }, { status: 403 });
    }

    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing developer token." }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const body = (await request.json()) as RequestBody;

    if (body.threadId !== "dev") {
      return NextResponse.json({ error: "Unsupported inbox thread." }, { status: 400 });
    }

    if (!body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: "Title and message text are required." }, { status: 400 });
    }

    await createFirestoreDocument("inboxPosts", {
      threadId: "dev",
      title: body.title.trim(),
      body: body.body.trim(),
      imageUrl: body.imageUrl || null,
      senderLabel: "Dev",
      senderType: "developer",
      createdAt: new Date(),
      createdByUid: decoded.sub,
      createdByEmail: decoded.email || null,
    });

    await writeAuditLog({
      action: "inbox_post.dev",
      actor: { uid: decoded.sub, email: decoded.email },
      targetType: "inboxThread",
      targetId: "dev",
      status: "success",
      message: "Developer inbox post created.",
      details: {
        hasImage: Boolean(body.imageUrl),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create inbox post." },
      { status: 500 }
    );
  }
}
