import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "../../../../../../lib/server/firebase-auth";
import { markDirectConversationRead } from "../../../../../../lib/server/direct-messages";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing user token." }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const { conversationId } = await context.params;

    await markDirectConversationRead({
      conversationId,
      userId: decoded.sub,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not mark the conversation as read." },
      { status: 500 }
    );
  }
}
