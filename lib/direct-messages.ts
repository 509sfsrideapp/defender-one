export type DirectMessageBucket = "direct" | "marketplace" | "iso" | "events" | "system";

export type DirectMessageConversationType = Exclude<DirectMessageBucket, "system">;

export type DirectMessageParticipantProfile = {
  uid: string;
  displayName: string;
  photoUrl?: string | null;
  rank?: string | null;
  flight?: string | null;
  username?: string | null;
  jobDescription?: string | null;
  bio?: string | null;
};

export type DirectMessageRelatedContext = {
  type: "marketplace" | "iso" | "events";
  targetId: string;
  title: string;
  previewImageUrl?: string | null;
  status?: string | null;
  ownerUid?: string | null;
  targetPath: string;
};

export type DirectMessageConversationDocument = {
  type: DirectMessageConversationType;
  participantIds: string[];
  participantKey: string;
  participantMap?: Record<string, true>;
  participantProfiles: Record<string, DirectMessageParticipantProfile>;
  createdAt?: { seconds?: number; nanoseconds?: number } | string | null;
  updatedAt?: { seconds?: number; nanoseconds?: number } | string | null;
  lastMessageAt?: { seconds?: number; nanoseconds?: number } | string | null;
  lastMessagePreview?: string | null;
  lastMessageSenderId?: string | null;
  unreadCounts?: Record<string, number>;
  lastReadAt?: Record<string, string>;
  relatedContext?: DirectMessageRelatedContext | null;
};

export type DirectMessageConversationRecord = DirectMessageConversationDocument & {
  id: string;
};

export type DirectMessageRecord = {
  id: string;
  conversationId: string;
  senderId?: string | null;
  senderLabel?: string | null;
  body: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | string | null;
  updatedAt?: { seconds?: number; nanoseconds?: number } | string | null;
  type?: "text" | "system";
};

export type DirectMessagePresenceRecord = {
  online?: boolean;
  currentThreadId?: string | null;
  lastActiveAt?: { ".sv"?: string } | string | null;
  updatedAt?: { ".sv"?: string } | string | null;
};

export type DirectMessageTypingRecord = {
  active?: boolean;
  preview?: string | null;
  startedAt?: { ".sv"?: string } | string | null;
};

export type DirectMessageThreadPresenceRecord = {
  viewing?: boolean;
  updatedAt?: { ".sv"?: string } | string | null;
};

export function buildParticipantKey(userIds: string[]) {
  return [...new Set(userIds.map((value) => value.trim()).filter(Boolean))].sort().join("__");
}

export function buildDirectConversationId(userA: string, userB: string) {
  return `direct__${buildParticipantKey([userA, userB])}`;
}

export function buildMarketplaceConversationId(listingId: string, userA: string, userB: string) {
  return `marketplace__${listingId}__${buildParticipantKey([userA, userB])}`;
}

export function buildIsoConversationId(requestId: string, userA: string, userB: string) {
  return `iso__${requestId}__${buildParticipantKey([userA, userB])}`;
}

export function buildEventConversationId(eventId: string, userA: string, userB: string) {
  return `events__${eventId}__${buildParticipantKey([userA, userB])}`;
}

export function getConversationBucket(type?: string | null): DirectMessageBucket {
  if (type === "marketplace" || type === "iso" || type === "events" || type === "direct") {
    return type;
  }

  return "system";
}

export function buildMessagePreview(body?: string | null, maxLength = 110) {
  const normalized = body?.replace(/\s+/g, " ").trim() || "";

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function formatConversationTimestamp(
  value?: { seconds?: number; nanoseconds?: number } | string | null
) {
  let timestampMs = 0;

  if (typeof value === "string") {
    timestampMs = Date.parse(value);
  } else if (value?.seconds) {
    timestampMs = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }

  if (!timestampMs || Number.isNaN(timestampMs)) {
    return "";
  }

  const diffMs = timestampMs - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const absoluteMinutes = Math.abs(diffMinutes);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absoluteMinutes < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return formatter.format(diffDays, "day");
  }

  return new Date(timestampMs).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function getOtherConversationParticipant(
  conversation: Pick<DirectMessageConversationDocument, "participantIds" | "participantProfiles">,
  currentUserId: string
) {
  const otherUserId = conversation.participantIds.find((participantId) => participantId !== currentUserId) || currentUserId;
  return conversation.participantProfiles?.[otherUserId] || null;
}

export function sortDirectMessageConversations(conversations: DirectMessageConversationRecord[]) {
  return [...conversations].sort((left, right) => {
    const leftTime =
      typeof left.lastMessageAt === "string"
        ? Date.parse(left.lastMessageAt)
        : (left.lastMessageAt?.seconds || 0) * 1000;
    const rightTime =
      typeof right.lastMessageAt === "string"
        ? Date.parse(right.lastMessageAt)
        : (right.lastMessageAt?.seconds || 0) * 1000;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return left.id.localeCompare(right.id);
  });
}
