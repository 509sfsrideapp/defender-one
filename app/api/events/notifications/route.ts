import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import { getFirestoreDocument } from "../../../../lib/server/firestore-admin";
import {
  listUserIdsForNotificationPreference,
  sendUserPushNotification,
} from "../../../../lib/server/user-notification-settings";

type RequestBody = {
  action?: "created" | "rsvp";
  eventId?: string;
  attendeeLabel?: string;
};

type EventRecord = {
  id: string;
  name?: string;
  createdByUid?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing user token." }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const body = (await request.json()) as RequestBody;
    const action = body.action;
    const eventId = body.eventId?.trim() || "";

    if (!action || !eventId) {
      return NextResponse.json({ error: "action and eventId are required." }, { status: 400 });
    }

    const eventRecord = await getFirestoreDocument<EventRecord>(`events/${eventId}`);

    if (!eventRecord) {
      return NextResponse.json({ error: "That event is unavailable." }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const eventName = eventRecord.name?.trim() || "New Event";

    if (action === "created") {
      const notificationUsers = await listUserIdsForNotificationPreference("eventCreations");

      await Promise.all(
        notificationUsers
          .filter((user) => user.id !== decoded.sub)
          .map((user) =>
            sendUserPushNotification({
              userId: user.id,
              preference: "eventCreations",
              title: "New Event Posted",
              body: `${eventName} is now live in Events.`,
              link: `/events/${eventId}`,
              origin,
            }).catch((error) => {
              console.error("Event creation notification failed", error);
            })
          )
      );

      return NextResponse.json({ ok: true });
    }

    const eventOwnerId = eventRecord.createdByUid?.trim() || "";
    const attendeeLabel = body.attendeeLabel?.trim() || "Someone";

    if (!eventOwnerId || eventOwnerId === decoded.sub) {
      return NextResponse.json({ ok: true });
    }

    await sendUserPushNotification({
      userId: eventOwnerId,
      preference: "eventRsvps",
      title: "New Event RSVP",
      body: `${attendeeLabel} joined your event "${eventName}".`,
      link: `/events/${eventId}`,
      origin,
    }).catch((error) => {
      console.error("Event RSVP notification failed", error);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send event notifications." },
      { status: 500 }
    );
  }
}
