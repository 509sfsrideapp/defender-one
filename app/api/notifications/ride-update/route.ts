import { NextResponse } from "next/server";
import { writeAuditLog } from "../../../../lib/server/audit-log";
import { getRideDoc, getUserNotificationTokens } from "../../../../lib/server/firestore-rest";
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
    const body = (await request.json()) as {
      rideId?: string;
      riderId?: string;
      event?: "accepted" | "arrived";
    };

    if (!body.rideId || !body.riderId || !body.event) {
      return NextResponse.json({ error: "Missing rider notification data." }, { status: 400 });
    }

    const ride = await getRideDoc(body.rideId);

    if (ride.acceptedBy !== decoded.sub || ride.riderId !== body.riderId) {
      return NextResponse.json({ error: "Unauthorized ride update notification request." }, { status: 403 });
    }

    const tokens = await getUserNotificationTokens(body.riderId);
    const title = body.event === "accepted" ? "Ride Accepted" : "Driver Arrived";
    const driverName = ride.driverName || "Your driver";
    const vehicleDescription = [ride.carColor, ride.carYear, ride.carMake, ride.carModel]
      .filter(Boolean)
      .join(" ")
      .trim();
    const messageBody =
      body.event === "accepted"
        ? `${driverName} accepted your ride.`
        : `${driverName} has arrived${vehicleDescription ? ` in a ${vehicleDescription}` : ""}.`;

    await sendPushMessage({
      tokens,
      title,
      body: messageBody,
      link: `/ride-status?rideId=${ride.id}`,
      origin: new URL(request.url).origin,
    });
    await writeAuditLog({
      action: `notification.ride_${body.event}`,
      actor: { uid: decoded.sub, email: decoded.email },
      targetType: "ride",
      targetId: ride.id,
      status: "success",
      message: `Ride ${body.event} notification queued for rider.`,
      details: {
        riderId: body.riderId,
        tokenCount: tokens.length,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    await writeAuditLog({
      action: "notification.ride_update",
      status: "failure",
      message: error instanceof Error ? error.message : "Could not send ride update notifications.",
    }).catch((auditError) => {
      console.error("Audit log write failed", auditError);
    });
    return NextResponse.json({ error: "Could not send ride update notifications." }, { status: 500 });
  }
}
