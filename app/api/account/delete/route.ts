import { NextResponse } from "next/server";
import { deleteFirestoreDocument, getFirestoreDocument } from "../../../../lib/server/firestore-admin";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import { deleteIdentityUser } from "../../../../lib/server/identity-toolkit";
import { writeAuditLog } from "../../../../lib/server/audit-log";
import { deleteUserOwnedDocuments } from "../../../../lib/server/account-cleanup";
import { normalizeUsername } from "../../../../lib/username";

type UserProfileRecord = {
  username?: string | null;
  carYear?: string | null;
  carMake?: string | null;
  carModel?: string | null;
  carColor?: string | null;
};

function normalizeVehicleValue(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const body = (await request.json()) as {
      vehicleYear?: string;
      vehicleMake?: string;
      vehicleModel?: string;
      vehicleColor?: string;
    };

    const userProfile = await getFirestoreDocument<UserProfileRecord>(`users/${decoded.sub}`);

    if (!userProfile) {
      return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
    }

    const matchesVehicle =
      normalizeVehicleValue(body.vehicleYear) === normalizeVehicleValue(userProfile.carYear) &&
      normalizeVehicleValue(body.vehicleMake) === normalizeVehicleValue(userProfile.carMake) &&
      normalizeVehicleValue(body.vehicleModel) === normalizeVehicleValue(userProfile.carModel) &&
      normalizeVehicleValue(body.vehicleColor) === normalizeVehicleValue(userProfile.carColor);

    if (!matchesVehicle) {
      return NextResponse.json({ error: "Vehicle information did not match this account." }, { status: 400 });
    }

    const cleanupResult = await deleteUserOwnedDocuments(decoded.sub);

    await deleteIdentityUser(decoded.sub);

    await deleteFirestoreDocument(`users/${decoded.sub}`);

    const normalizedUsername = normalizeUsername(userProfile.username || "");
    if (normalizedUsername) {
      await deleteFirestoreDocument(`usernames/${normalizedUsername}`);
    }

    await writeAuditLog({
      action: "account.self_delete",
      actor: { uid: decoded.sub, email: decoded.email },
      targetType: "user",
      targetId: decoded.sub,
      status: "success",
      message: "User deleted their own account and associated owned data was cleaned up.",
      details: {
        username: normalizedUsername || null,
        cleanupDeletedCount: cleanupResult.totalDeleted,
        cleanupDeletedByCollection: cleanupResult.deletedByCollection,
        preservedCollections: ["rides"],
      },
    }).catch((auditError) => {
      console.error("Audit log write failed", auditError);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    await writeAuditLog({
      action: "account.self_delete",
      status: "failure",
      message: error instanceof Error ? error.message : "Could not delete this account.",
    }).catch((auditError) => {
      console.error("Audit log write failed", auditError);
    });
    return NextResponse.json({ error: "Could not delete this account." }, { status: 500 });
  }
}
