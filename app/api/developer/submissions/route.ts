import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "../../../../lib/server/audit-log";
import { deleteFirestoreDocument, getFirestoreDocument, listFirestoreDocuments, patchFirestoreDocument } from "../../../../lib/server/firestore-admin";
import { createUserInboxPostAndMaybeNotify } from "../../../../lib/server/user-notification-settings";

const DEVELOPER_COOKIE_NAME = "developer_access";

type SubmissionDocument = {
  id: string;
  title?: string | null;
  reporterUid?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
};

type PostRequestBody = {
  action?: "respond";
  type?: string;
  submissionId?: string;
  body?: string;
};

function getAllowedCollection(type: string | null) {
  if (type === "bugReports") {
    return "bugReports";
  }

  if (type === "suggestions") {
    return "suggestions";
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const accessCookie = request.cookies.get(DEVELOPER_COOKIE_NAME);

    if (accessCookie?.value !== "granted") {
      return NextResponse.json({ error: "Developer access required." }, { status: 403 });
    }

    const collectionName = getAllowedCollection(request.nextUrl.searchParams.get("type"));

    if (!collectionName) {
      return NextResponse.json({ error: "Unsupported submission type." }, { status: 400 });
    }

    const documents = (await listFirestoreDocuments(collectionName)) as SubmissionDocument[];
    const sorted = documents.sort((a, b) => {
      const aTime = typeof a.createdAt === "string" ? Date.parse(a.createdAt) : 0;
      const bTime = typeof b.createdAt === "string" ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ items: sorted });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load submissions." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessCookie = request.cookies.get(DEVELOPER_COOKIE_NAME);

    if (accessCookie?.value !== "granted") {
      return NextResponse.json({ error: "Developer access required." }, { status: 403 });
    }

    const body = (await request.json()) as PostRequestBody;
    const collectionName = getAllowedCollection(body.type || null);
    const submissionId = body.submissionId?.trim();
    const messageBody = body.body?.trim();

    if (body.action !== "respond" || !collectionName || !submissionId || !messageBody) {
      return NextResponse.json({ error: "action, type, submissionId, and body are required." }, { status: 400 });
    }

    const submission = await getFirestoreDocument<SubmissionDocument>(`${collectionName}/${submissionId}`);

    if (!submission) {
      return NextResponse.json({ error: "That submission could not be found." }, { status: 404 });
    }

    const userId = submission.reporterUid?.trim();
    const sourceTitle = submission.title?.trim() || "Submission";
    const responseTitle = `RE: ${sourceTitle}`;

    if (!userId) {
      return NextResponse.json({ error: "This submission is missing its reporter account reference." }, { status: 400 });
    }

    await createUserInboxPostAndMaybeNotify({
      userId,
      threadId: "dev",
      senderLabel: "Dev",
      senderType: "developer",
      title: responseTitle,
      body: messageBody,
      createdByUid: "developer_access",
      createdByEmail: null,
      link: "/inbox/dev",
      origin: new URL(request.url).origin,
    });

    await patchFirestoreDocument(`${collectionName}/${submissionId}`, {
      respondedAt: new Date(),
      respondedTitle: responseTitle,
      respondedBody: messageBody,
    });

    await writeAuditLog({
      action: "developer.submission.respond",
      targetType: collectionName,
      targetId: submissionId,
      status: "success",
      message: `Sent developer response for ${collectionName}/${submissionId}.`,
      details: {
        userId,
        responseTitle,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send the developer response." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const accessCookie = request.cookies.get(DEVELOPER_COOKIE_NAME);

    if (accessCookie?.value !== "granted") {
      return NextResponse.json({ error: "Developer access required." }, { status: 403 });
    }

    const collectionName = getAllowedCollection(request.nextUrl.searchParams.get("type"));
    const submissionId = request.nextUrl.searchParams.get("submissionId")?.trim();

    if (!collectionName || !submissionId) {
      return NextResponse.json({ error: "type and submissionId are required." }, { status: 400 });
    }

    await deleteFirestoreDocument(`${collectionName}/${submissionId}`);

    await writeAuditLog({
      action: "developer.submission.delete",
      targetType: collectionName,
      targetId: submissionId,
      status: "success",
      message: `Deleted ${collectionName}/${submissionId} from the developer queue.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete the submission." },
      { status: 500 }
    );
  }
}
