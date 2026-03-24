import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "../../../../lib/admin";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import { deleteFirestoreDocument, patchFirestoreDocument } from "../../../../lib/server/firestore-admin";
import { deleteIdentityUser, setIdentityUserDisabled } from "../../../../lib/server/identity-toolkit";

type AdminAccountAction = "freeze" | "unfreeze" | "delete";

type RequestBody = {
  action?: AdminAccountAction;
  userId?: string;
  username?: string;
  email?: string;
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function POST(request: NextRequest) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json({ error: "Missing admin token." }, { status: 401 });
    }

    const adminToken = await verifyFirebaseIdToken(idToken);

    if (!isAdminEmail(adminToken.email)) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

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

      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      await patchFirestoreDocument(`users/${userId}`, {
        accountFrozen: true,
        deletedAt: new Date(),
        deletedByAdminEmail: adminToken.email || "admin",
        available: false,
      });

      if (username) {
        await deleteFirestoreDocument(`usernames/${username.toLowerCase()}`);
      }

      await deleteIdentityUser(userId);
      await deleteFirestoreDocument(`users/${userId}`);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not manage that account." },
      { status: 500 }
    );
  }
}
