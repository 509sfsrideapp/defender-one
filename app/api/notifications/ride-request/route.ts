import { NextResponse } from "next/server";
import { writeAuditLog } from "../../../../lib/server/audit-log";
import { getAvailableDriverNotificationTokens, getRideDoc } from "../../../../lib/server/firestore-rest";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import { sendPushMessage } from "../../../../lib/server/fcm";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const body = (await request.json()) as { rideId?: string };

    if (!body.rideId) {
      return NextResponse.json({ error: "Missing rideId" }, { status: 400 });
    }

    const ride = await getRideDoc(body.rideId);

    if (ride.riderId !== decoded.sub || ride.status !== "open") {
      return NextResponse.json({ error: "Unauthorized ride notification request." }, { status: 403 });
    }

    const tokens = await getAvailableDriverNotificationTokens();

    await sendPushMessage({
      tokens,
      title: "New Ride Request",
      body: `${ride.riderName || decoded.email || "A rider"} needs a pickup${ride.pickup ? ` near ${ride.pickup}` : ""}.`,
      link: "/driver",
      origin: new URL(request.url).origin,
    });
    await writeAuditLog({
      action: "notification.ride_request",
      actor: { uid: decoded.sub, email: decoded.email },
      targetType: "ride",
      targetId: ride.id,
      status: "success",
      message: "Ride request notifications queued for available drivers.",
      details: {
        tokenCount: tokens.length,
        riderId: ride.riderId || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    await writeAuditLog({
      action: "notification.ride_request",
      status: "failure",
      message: error instanceof Error ? error.message : "Could not send ride request notifications.",
    }).catch((auditError) => {
      console.error("Audit log write failed", auditError);
    });
    return NextResponse.json({ error: "Could not send ride request notifications." }, { status: 500 });
  }
}
