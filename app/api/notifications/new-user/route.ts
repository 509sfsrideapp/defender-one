import { NextRequest, NextResponse } from "next/server";
import { ADMIN_EMAILS } from "../../../../lib/admin";
import { getFirestoreDocument, listFirestoreDocuments } from "../../../../lib/server/firestore-admin";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import { createUserInboxPostAndMaybeNotify } from "../../../../lib/server/user-notification-settings";

type UserRecord = {
  id: string;
  email?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing user token." }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const createdUser = await getFirestoreDocument<UserRecord>(`users/${decoded.sub}`);

    if (!createdUser) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const createdUserName =
      createdUser.name?.trim() ||
      [createdUser.firstName?.trim(), createdUser.lastName?.trim()].filter(Boolean).join(" ").trim() ||
      createdUser.email?.trim() ||
      "A new user";

    const allUsers = (await listFirestoreDocuments("users")) as UserRecord[];
    const adminUsers = allUsers.filter((user) => {
      const email = user.email?.trim().toLowerCase();
      return Boolean(email && ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email));
    });

    const origin = new URL(request.url).origin;

    await Promise.all(
      adminUsers.map((adminUser) =>
        createUserInboxPostAndMaybeNotify({
          userId: adminUser.id,
          threadId: "notifications",
          senderLabel: "Notifications",
          title: "New User",
          body: `${createdUserName} made a new account`,
          link: "/admin/accounts",
          origin,
        }).catch((error) => {
          console.error("New user admin notification failed", error);
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send new user notifications." },
      { status: 500 }
    );
  }
}
