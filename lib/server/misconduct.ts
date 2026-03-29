import { deleteQAPost } from "./q-and-a";
import {
  createFirestoreDocument,
  deleteFirestoreDocument,
  getFirestoreDocument,
  listFirestoreDocuments,
  listFirestoreDocumentsByField,
  patchFirestoreDocument,
} from "./firestore-admin";
import type { MisconductReportRecord, MisconductTargetType } from "../misconduct";
import { formatMisconductTargetTypeLabel } from "../misconduct";

type EventAttendanceRecord = {
  id: string;
  path: string;
};

type QAPostTargetRecord = {
  authorId: string;
  deleted?: boolean;
};

type QACommentTargetRecord = {
  postId: string;
  authorId: string;
  deleted?: boolean;
};

type MisconductDecision = "allow" | "delete";

export async function listMisconductReports() {
  const reports = (await listFirestoreDocuments("misconductReports")) as MisconductReportRecord[];

  return reports.sort((left, right) => {
    const leftTime = typeof left.createdAt === "string" ? Date.parse(left.createdAt) : 0;
    const rightTime = typeof right.createdAt === "string" ? Date.parse(right.createdAt) : 0;

    if (left.status !== right.status) {
      return left.status === "open" ? -1 : 1;
    }

    return rightTime - leftTime;
  });
}

export async function createMisconductResolutionMessage(input: {
  report: MisconductReportRecord;
  action: MisconductDecision;
  message?: string | null;
  resolvedByUid: string;
  resolvedByEmail?: string | null;
}) {
  const actionLabel = input.action === "delete" ? "Content Deleted" : "Content Allowed";
  const typeLabel = formatMisconductTargetTypeLabel(input.report.targetType);
  const detailMessage = input.message?.trim();

  const bodyLines = [
    `Your misconduct report for ${typeLabel.toUpperCase()} // ${input.report.targetLabel} has been reviewed.`,
    `Decision: ${actionLabel}.`,
  ];

  if (detailMessage) {
    bodyLines.push("");
    bodyLines.push(detailMessage);
  }

  await createFirestoreDocument("userInboxPosts", {
    userId: input.report.reporterUid,
    threadId: "admin",
    senderLabel: "Admin",
    senderType: "admin",
    title: `Report Review // ${actionLabel}`,
    body: bodyLines.join("\n"),
    imageUrl: null,
    requiresResponse: false,
    responsePrompt: null,
    responseText: null,
    responseSubmittedAt: null,
    readAt: null,
    readByUserId: null,
    createdAt: new Date(),
    createdByUid: input.resolvedByUid,
    createdByEmail: input.resolvedByEmail || null,
  });
}

async function deleteMisconductTarget(targetType: MisconductTargetType, targetId: string) {
  if (targetType === "event") {
    const attendees = (await listFirestoreDocumentsByField("eventAttendees", "eventId", targetId)) as EventAttendanceRecord[];
    await Promise.all(attendees.map((attendee) => deleteFirestoreDocument(attendee.path)));
    await deleteFirestoreDocument(`events/${targetId}`);
    return;
  }

  if (targetType === "marketplace_listing") {
    await deleteFirestoreDocument(`marketplaceListings/${targetId}`);
    return;
  }

  if (targetType === "iso_request") {
    await deleteFirestoreDocument(`isoRequests/${targetId}`);
    return;
  }

  if (targetType === "qa_post") {
    const post = await getFirestoreDocument<QAPostTargetRecord>(`qaPosts/${targetId}`);

    if (!post || post.deleted) {
      return;
    }

    await deleteQAPost({
      postId: targetId,
      authorId: post.authorId,
      allowAdminDelete: true,
    });
    return;
  }

  const comment = await getFirestoreDocument<QACommentTargetRecord>(`qaComments/${targetId}`);

  if (!comment || comment.deleted) {
    return;
  }

  await patchFirestoreDocument(`qaComments/${targetId}`, {
    body: "",
    deleted: true,
    updatedAt: new Date(),
  });
}

export async function resolveMisconductReport(input: {
  reportId: string;
  action: MisconductDecision;
  message?: string | null;
  resolvedByUid: string;
  resolvedByEmail?: string | null;
}) {
  const report = await getFirestoreDocument<MisconductReportRecord>(`misconductReports/${input.reportId}`);

  if (!report) {
    throw new Error("That misconduct report could not be found.");
  }

  if (report.status !== "open") {
    throw new Error("That misconduct report has already been resolved.");
  }

  if (input.action === "delete") {
    await deleteMisconductTarget(report.targetType, report.targetId);
  }

  const nextStatus = input.action === "delete" ? "deleted" : "allowed";

  await patchFirestoreDocument(`misconductReports/${input.reportId}`, {
    status: nextStatus,
    resolutionAction: input.action,
    resolutionMessage: input.message?.trim() || null,
    resolvedAt: new Date(),
    resolvedByUid: input.resolvedByUid,
    resolvedByEmail: input.resolvedByEmail || null,
  });

  await createMisconductResolutionMessage({
    report,
    action: input.action,
    message: input.message,
    resolvedByUid: input.resolvedByUid,
    resolvedByEmail: input.resolvedByEmail,
  });

  return {
    ...report,
    status: nextStatus,
  };
}
