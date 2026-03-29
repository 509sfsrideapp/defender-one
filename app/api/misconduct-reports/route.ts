import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "../../../lib/server/firebase-auth";
import { createFirestoreDocument, getFirestoreDocument } from "../../../lib/server/firestore-admin";
import { writeAuditLog } from "../../../lib/server/audit-log";
import { buildQAAuthorLabel, type QAAuthorProfile } from "../../../lib/q-and-a";
import { buildMisconductPreviewText, type MisconductTargetSelection } from "../../../lib/misconduct";

type RequestBody = {
  target?: MisconductTargetSelection;
  description?: string;
};

type UserProfileRecord = QAAuthorProfile & {
  email?: string | null;
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
    const target = body.target;
    const description = body.description?.trim() || "";

    if (!target?.targetType || !target.targetId || !target.targetLabel.trim() || !target.targetPath.trim()) {
      return NextResponse.json({ error: "A misconduct target is required." }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: "A misconduct description is required." }, { status: 400 });
    }

    const reporterProfile = await getFirestoreDocument<UserProfileRecord>(`users/${decoded.sub}`);
    const reporterLabel = buildQAAuthorLabel(reporterProfile, decoded.email || reporterProfile?.email || null);

    await createFirestoreDocument("misconductReports", {
      targetType: target.targetType,
      targetId: target.targetId,
      targetLabel: target.targetLabel.trim(),
      targetPreview: buildMisconductPreviewText(target.targetPreview),
      targetPath: target.targetPath.trim(),
      targetOwnerUid: target.targetOwnerUid?.trim() || null,
      reporterUid: decoded.sub,
      reporterLabel,
      reporterEmail: decoded.email || reporterProfile?.email || null,
      description,
      status: "open",
      resolutionAction: null,
      resolutionMessage: null,
      resolvedAt: null,
      resolvedByUid: null,
      resolvedByEmail: null,
      createdAt: new Date(),
    });

    await writeAuditLog({
      action: "misconduct.report.create",
      actor: { uid: decoded.sub, email: decoded.email },
      targetType: target.targetType,
      targetId: target.targetId,
      status: "success",
      message: `Created misconduct report for ${target.targetType}/${target.targetId}.`,
      details: {
        targetLabel: target.targetLabel.trim(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create misconduct report." },
      { status: 500 }
    );
  }
}
