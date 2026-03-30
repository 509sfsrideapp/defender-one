import {
  createFirestoreDocument,
  getFirestoreDocument,
  listFirestoreDocuments,
  listFirestoreDocumentsByFieldOperator,
} from "./firestore-admin";
import {
  getRealtimeDatabaseValue,
  pushRealtimeDatabaseValue,
  setRealtimeDatabaseValue,
} from "./realtime-database";
import {
  buildDirectConversationId,
  buildIsoConversationId,
  buildMarketplaceConversationId,
  buildMessagePreview,
  buildParticipantKey,
  type DirectMessageConversationRecord,
  type DirectMessageConversationType,
  type DirectMessageParticipantProfile,
  type DirectMessageRecord,
  type DirectMessageRelatedContext,
} from "../direct-messages";
import { type IsoRequestRecord } from "../iso";
import { type MarketplaceListingRecord } from "../marketplace";
import { buildQAAuthorLabel, type QAAuthorProfile } from "../q-and-a";

type UserProfileRecord = QAAuthorProfile & {
  email?: string | null;
  flight?: string | null;
  username?: string | null;
  bio?: string | null;
  jobDescription?: string | null;
};

type StoredDirectMessageConversation = Omit<DirectMessageConversationRecord, "id">;
type StoredDirectMessageRecord = Omit<DirectMessageRecord, "id">;

const DM_CONVERSATIONS_PATH = "dmConversations";
const DM_MESSAGES_PATH = "dmMessages";
const DM_USER_CONVERSATIONS_PATH = "dmUserConversations";

async function buildParticipantProfile(userId: string, fallbackEmail?: string | null) {
  const userProfile = await getFirestoreDocument<UserProfileRecord>(`users/${userId}`);

  if (!userProfile) {
    throw new Error("That user account is unavailable.");
  }

  return {
    uid: userId,
    displayName: buildQAAuthorLabel(userProfile, fallbackEmail || userProfile.email || null),
    photoUrl: userProfile.riderPhotoUrl || userProfile.driverPhotoUrl || null,
    rank: userProfile.rank?.trim() || null,
    flight: userProfile.flight?.trim() || null,
    username: userProfile.username?.trim() || null,
    jobDescription: userProfile.jobDescription?.trim() || null,
    bio: userProfile.bio?.trim() || null,
  } satisfies DirectMessageParticipantProfile;
}

function buildInitialConversationRecord(input: {
  conversationId: string;
  type: DirectMessageConversationType;
  participantProfiles: DirectMessageParticipantProfile[];
  relatedContext?: DirectMessageRelatedContext | null;
}) {
  const participantIds = input.participantProfiles.map((profile) => profile.uid).sort();
  const participantProfiles = Object.fromEntries(
    input.participantProfiles.map((profile) => [profile.uid, profile])
  );
  const participantMap = Object.fromEntries(
    participantIds.map((participantId) => [participantId, true as const])
  );

  return {
    id: input.conversationId,
    type: input.type,
    participantIds,
    participantKey: buildParticipantKey(participantIds),
    participantMap,
    participantProfiles,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessageAt: null,
    lastMessagePreview: "",
    lastMessageSenderId: null,
    unreadCounts: Object.fromEntries(participantIds.map((participantId) => [participantId, 0])),
    lastReadAt: {},
    relatedContext: input.relatedContext || null,
  } satisfies DirectMessageConversationRecord;
}

function toStoredConversation(
  conversation: DirectMessageConversationRecord
): StoredDirectMessageConversation {
  const { id, ...storedConversation } = conversation;
  void id;
  return storedConversation;
}

function fromStoredConversation(
  conversationId: string,
  conversation: StoredDirectMessageConversation | null
) {
  if (!conversation) {
    return null;
  }

  return {
    id: conversationId,
    ...conversation,
  } satisfies DirectMessageConversationRecord;
}

function fromStoredMessage(messageId: string, message: StoredDirectMessageRecord) {
  return {
    id: messageId,
    ...message,
  } satisfies DirectMessageRecord;
}

async function syncConversationSummary(conversation: DirectMessageConversationRecord) {
  const storedConversation = toStoredConversation({
    ...conversation,
    participantMap:
      conversation.participantMap ||
      Object.fromEntries(
        (conversation.participantIds || []).map((participantId) => [participantId, true as const])
      ),
  });

  await setRealtimeDatabaseValue(`${DM_CONVERSATIONS_PATH}/${conversation.id}`, storedConversation);
  await Promise.all(
    conversation.participantIds.map((participantId) =>
      setRealtimeDatabaseValue(
        `${DM_USER_CONVERSATIONS_PATH}/${participantId}/${conversation.id}`,
        storedConversation
      )
    )
  );
}

async function getRealtimeConversation(conversationId: string) {
  const conversation = await getRealtimeDatabaseValue<StoredDirectMessageConversation>(
    `${DM_CONVERSATIONS_PATH}/${conversationId}`
  );

  return fromStoredConversation(conversationId, conversation);
}

async function listRealtimeConversationsForUser(userId: string) {
  const conversations = await getRealtimeDatabaseValue<
    Record<string, StoredDirectMessageConversation> | null
  >(`${DM_USER_CONVERSATIONS_PATH}/${userId}`);

  return Object.entries(conversations || {}).map(([conversationId, conversation]) =>
    fromStoredConversation(conversationId, conversation)
  ).filter((conversation): conversation is DirectMessageConversationRecord => Boolean(conversation));
}

async function listRealtimeMessagesForConversation(conversationId: string) {
  const messages = await getRealtimeDatabaseValue<Record<string, StoredDirectMessageRecord> | null>(
    `${DM_MESSAGES_PATH}/${conversationId}`
  );

  return Object.entries(messages || {})
    .map(([messageId, message]) => fromStoredMessage(messageId, message))
    .sort((left, right) => {
      const leftTime =
        typeof left.createdAt === "string"
          ? Date.parse(left.createdAt)
          : (left.createdAt?.seconds || 0) * 1000;
      const rightTime =
        typeof right.createdAt === "string"
          ? Date.parse(right.createdAt)
          : (right.createdAt?.seconds || 0) * 1000;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return String(left.id || "").localeCompare(String(right.id || ""));
    });
}

async function getLegacyFirestoreConversation(conversationId: string) {
  return await getFirestoreDocument<DirectMessageConversationRecord>(
    `${DM_CONVERSATIONS_PATH}/${conversationId}`
  );
}

async function listLegacyFirestoreConversationsForUser(userId: string) {
  return await listFirestoreDocumentsByFieldOperator<
    Omit<DirectMessageConversationRecord, "id">
  >(
    DM_CONVERSATIONS_PATH,
    "participantIds",
    "ARRAY_CONTAINS",
    userId
  );
}

async function listLegacyFirestoreMessagesForConversation(conversationId: string) {
  return (await listFirestoreDocuments(
    `${DM_CONVERSATIONS_PATH}/${conversationId}/messages`
  )) as DirectMessageRecord[];
}

async function migrateLegacyConversationIfNeeded(conversationId: string) {
  const existingConversation = await getRealtimeConversation(conversationId);

  if (existingConversation) {
    return existingConversation;
  }

  const legacyConversation = await getLegacyFirestoreConversation(conversationId);

  if (!legacyConversation) {
    return null;
  }

  await syncConversationSummary(legacyConversation);

  const legacyMessages = await listLegacyFirestoreMessagesForConversation(conversationId);
  await Promise.all(
    legacyMessages.map((message) => {
      const { id, ...storedMessage } = message;
      return setRealtimeDatabaseValue(
        `${DM_MESSAGES_PATH}/${conversationId}/${id}`,
        storedMessage
      );
    })
  );

  return legacyConversation;
}

async function createConversationIfMissing(input: {
  conversationId: string;
  type: DirectMessageConversationType;
  participantProfiles: DirectMessageParticipantProfile[];
  relatedContext?: DirectMessageRelatedContext | null;
}) {
  const existingConversation = await migrateLegacyConversationIfNeeded(input.conversationId);

  if (existingConversation) {
    return existingConversation;
  }

  const nextConversation = buildInitialConversationRecord(input);
  await syncConversationSummary(nextConversation);
  return nextConversation;
}

export async function openDirectConversation(input: {
  currentUserId: string;
  currentUserEmail?: string | null;
  otherUserId: string;
}) {
  if (!input.otherUserId || input.otherUserId === input.currentUserId) {
    throw new Error("You can only open a direct thread with another user.");
  }

  const [currentUserProfile, otherUserProfile] = await Promise.all([
    buildParticipantProfile(input.currentUserId, input.currentUserEmail || null),
    buildParticipantProfile(input.otherUserId, null),
  ]);

  return await createConversationIfMissing({
    conversationId: buildDirectConversationId(input.currentUserId, input.otherUserId),
    type: "direct",
    participantProfiles: [currentUserProfile, otherUserProfile],
  });
}

export async function openMarketplaceConversation(input: {
  currentUserId: string;
  currentUserEmail?: string | null;
  listingId: string;
}) {
  const listing = await getFirestoreDocument<MarketplaceListingRecord>(
    `marketplaceListings/${input.listingId}`
  );

  if (!listing) {
    throw new Error("That listing is unavailable.");
  }

  const ownerUid = listing.createdByUid?.trim() || "";
  if (!ownerUid || ownerUid === input.currentUserId) {
    throw new Error("You cannot create a marketplace thread with this listing.");
  }

  const [currentUserProfile, ownerProfile] = await Promise.all([
    buildParticipantProfile(input.currentUserId, input.currentUserEmail || null),
    buildParticipantProfile(ownerUid, listing.createdByEmail || null),
  ]);

  return await createConversationIfMissing({
    conversationId: buildMarketplaceConversationId(listing.id, input.currentUserId, ownerUid),
    type: "marketplace",
    participantProfiles: [currentUserProfile, ownerProfile],
    relatedContext: {
      type: "marketplace",
      targetId: listing.id,
      title: listing.title,
      previewImageUrl: listing.photoUrl || null,
      status: listing.status,
      ownerUid,
      targetPath: `/marketplace/${listing.id}`,
    },
  });
}

export async function openIsoConversation(input: {
  currentUserId: string;
  currentUserEmail?: string | null;
  requestId: string;
}) {
  const requestRecord = await getFirestoreDocument<IsoRequestRecord>(`isoRequests/${input.requestId}`);

  if (!requestRecord) {
    throw new Error("That ISO request is unavailable.");
  }

  const ownerUid = requestRecord.createdByUid?.trim() || "";
  if (!ownerUid || ownerUid === input.currentUserId) {
    throw new Error("You cannot create an ISO thread with this request.");
  }

  const [currentUserProfile, ownerProfile] = await Promise.all([
    buildParticipantProfile(input.currentUserId, input.currentUserEmail || null),
    buildParticipantProfile(ownerUid, requestRecord.createdByEmail || null),
  ]);

  return await createConversationIfMissing({
    conversationId: buildIsoConversationId(requestRecord.id, input.currentUserId, ownerUid),
    type: "iso",
    participantProfiles: [currentUserProfile, ownerProfile],
    relatedContext: {
      type: "iso",
      targetId: requestRecord.id,
      title: requestRecord.title,
      previewImageUrl: requestRecord.photoUrl || null,
      status: requestRecord.status,
      ownerUid,
      targetPath: `/iso/${requestRecord.id}`,
    },
  });
}

export async function getDirectMessageConversation(conversationId: string) {
  return await migrateLegacyConversationIfNeeded(conversationId);
}

export async function listDirectMessageConversationsForUser(userId: string) {
  const realtimeConversations = await listRealtimeConversationsForUser(userId);

  if (realtimeConversations.length > 0) {
    return realtimeConversations.filter((conversation) =>
      conversation.participantIds?.includes(userId)
    );
  }

  const legacyConversations = await listLegacyFirestoreConversationsForUser(userId);

  await Promise.all(
    legacyConversations
      .filter((conversation) => conversation.participantIds?.includes(userId))
      .map((conversation) => syncConversationSummary(conversation))
  );

  return legacyConversations.filter((conversation) => conversation.participantIds?.includes(userId));
}

export async function listDirectMessagesForConversation(input: {
  conversationId: string;
  userId: string;
}) {
  const conversation = await getDirectMessageConversation(input.conversationId);

  if (!conversation) {
    throw new Error("That conversation is unavailable.");
  }

  if (!conversation.participantIds.includes(input.userId)) {
    throw new Error("You do not have access to that conversation.");
  }

  const realtimeMessages = await listRealtimeMessagesForConversation(input.conversationId);

  if (realtimeMessages.length > 0) {
    return realtimeMessages;
  }

  const legacyMessages = await listLegacyFirestoreMessagesForConversation(input.conversationId);

  if (legacyMessages.length > 0) {
    await Promise.all(
      legacyMessages.map((message) => {
        const { id, ...storedMessage } = message;
        return setRealtimeDatabaseValue(
          `${DM_MESSAGES_PATH}/${input.conversationId}/${id}`,
          storedMessage
        );
      })
    );
  }

  return legacyMessages.sort((left, right) => {
    const leftTime =
      typeof left.createdAt === "string"
        ? Date.parse(left.createdAt)
        : (left.createdAt?.seconds || 0) * 1000;
    const rightTime =
      typeof right.createdAt === "string"
        ? Date.parse(right.createdAt)
        : (right.createdAt?.seconds || 0) * 1000;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(left.id || "").localeCompare(String(right.id || ""));
  });
}

export async function sendDirectMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const conversation = await getDirectMessageConversation(input.conversationId);

  if (!conversation) {
    throw new Error("That conversation is unavailable.");
  }

  if (!conversation.participantIds.includes(input.senderId)) {
    throw new Error("You do not have access to that conversation.");
  }

  const senderProfile = conversation.participantProfiles?.[input.senderId];
  const normalizedBody = input.body.trim();

  if (!normalizedBody) {
    throw new Error("Message text is required.");
  }

  const createdAt = new Date().toISOString();
  const messageResponse = await pushRealtimeDatabaseValue<
    StoredDirectMessageRecord
  >(`${DM_MESSAGES_PATH}/${input.conversationId}`, {
    conversationId: input.conversationId,
    senderId: input.senderId,
    senderLabel: senderProfile?.displayName || "Unknown User",
    body: normalizedBody,
    type: "text",
    createdAt,
    updatedAt: createdAt,
  });

  if (!messageResponse.name) {
    throw new Error("Could not create the direct message record.");
  }

  const nextUnreadCounts = { ...(conversation.unreadCounts || {}) };
  const nextLastReadAt = {
    ...(conversation.lastReadAt || {}),
    [input.senderId]: createdAt,
  };

  conversation.participantIds.forEach((participantId) => {
    if (participantId === input.senderId) {
      nextUnreadCounts[participantId] = 0;
      return;
    }

    nextUnreadCounts[participantId] = (Number(nextUnreadCounts[participantId] || 0) || 0) + 1;
  });

  const nextConversation: DirectMessageConversationRecord = {
    ...conversation,
    updatedAt: createdAt,
    lastMessageAt: createdAt,
    lastMessagePreview: buildMessagePreview(normalizedBody),
    lastMessageSenderId: input.senderId,
    unreadCounts: nextUnreadCounts,
    lastReadAt: nextLastReadAt,
  };

  await syncConversationSummary(nextConversation);
}

export async function markDirectConversationRead(input: {
  conversationId: string;
  userId: string;
}) {
  const conversation = await getDirectMessageConversation(input.conversationId);

  if (!conversation) {
    throw new Error("That conversation is unavailable.");
  }

  if (!conversation.participantIds.includes(input.userId)) {
    throw new Error("You do not have access to that conversation.");
  }

  const now = new Date().toISOString();
  const nextConversation: DirectMessageConversationRecord = {
    ...conversation,
    unreadCounts: { ...(conversation.unreadCounts || {}), [input.userId]: 0 },
    lastReadAt: { ...(conversation.lastReadAt || {}), [input.userId]: now },
    updatedAt: now,
  };

  await syncConversationSummary(nextConversation);
}

export async function backfillDirectMessageConversationToRealtimeDatabase(
  conversationId: string
) {
  const conversation = await getLegacyFirestoreConversation(conversationId);

  if (!conversation) {
    return null;
  }

  await syncConversationSummary(conversation);
  const messages = await listLegacyFirestoreMessagesForConversation(conversationId);

  await Promise.all(
    messages.map((message) => {
      const { id, ...storedMessage } = message;
      return setRealtimeDatabaseValue(
        `${DM_MESSAGES_PATH}/${conversationId}/${id}`,
        storedMessage
      );
    })
  );

  return conversation;
}

export async function seedDirectConversationToFirestoreForRollback(
  conversation: DirectMessageConversationRecord,
  messages: DirectMessageRecord[]
) {
  const legacyConversation = await getLegacyFirestoreConversation(conversation.id);

  if (!legacyConversation) {
    await createFirestoreDocument(
      DM_CONVERSATIONS_PATH,
      conversation,
      conversation.id
    );
  }

  await Promise.all(
    messages.map((message) => {
      const { id, ...storedMessage } = message;
      return createFirestoreDocument(
        `${DM_CONVERSATIONS_PATH}/${conversation.id}/messages`,
        storedMessage,
        id
      ).catch(() => undefined);
    })
  );
}
