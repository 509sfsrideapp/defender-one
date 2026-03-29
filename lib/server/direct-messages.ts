import {
  createFirestoreDocument,
  getFirestoreDocument,
  patchFirestoreDocument,
} from "./firestore-admin";
import {
  buildDirectConversationId,
  buildIsoConversationId,
  buildMarketplaceConversationId,
  buildMessagePreview,
  buildParticipantKey,
  type DirectMessageConversationRecord,
  type DirectMessageConversationType,
  type DirectMessageParticipantProfile,
  type DirectMessageRelatedContext,
} from "../direct-messages";
import { buildQAAuthorLabel, type QAAuthorProfile } from "../q-and-a";
import { type MarketplaceListingRecord } from "../marketplace";
import { type IsoRequestRecord } from "../iso";

type UserProfileRecord = QAAuthorProfile & {
  email?: string | null;
  flight?: string | null;
  username?: string | null;
  bio?: string | null;
  jobDescription?: string | null;
};

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

  return {
    id: input.conversationId,
    type: input.type,
    participantIds,
    participantKey: buildParticipantKey(participantIds),
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

async function createConversationIfMissing(input: {
  conversationId: string;
  type: DirectMessageConversationType;
  participantProfiles: DirectMessageParticipantProfile[];
  relatedContext?: DirectMessageRelatedContext | null;
}) {
  const existing = await getFirestoreDocument<DirectMessageConversationRecord>(`dmConversations/${input.conversationId}`);

  if (existing) {
    return existing;
  }

  const nextConversation = buildInitialConversationRecord(input);
  await createFirestoreDocument("dmConversations", nextConversation, input.conversationId);
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
  const listing = await getFirestoreDocument<MarketplaceListingRecord>(`marketplaceListings/${input.listingId}`);

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
  return await getFirestoreDocument<DirectMessageConversationRecord>(`dmConversations/${conversationId}`);
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

  const createdAt = new Date();
  await createFirestoreDocument(`dmConversations/${input.conversationId}/messages`, {
    conversationId: input.conversationId,
    senderId: input.senderId,
    senderLabel: senderProfile?.displayName || "Unknown User",
    body: normalizedBody,
    type: "text",
    createdAt,
    updatedAt: createdAt,
  });

  const nextUnreadCounts = { ...(conversation.unreadCounts || {}) };
  const nextLastReadAt = { ...(conversation.lastReadAt || {}), [input.senderId]: createdAt.toISOString() };
  conversation.participantIds.forEach((participantId) => {
    if (participantId === input.senderId) {
      nextUnreadCounts[participantId] = 0;
      return;
    }

    nextUnreadCounts[participantId] = (Number(nextUnreadCounts[participantId] || 0) || 0) + 1;
  });

  await patchFirestoreDocument(`dmConversations/${input.conversationId}`, {
    updatedAt: createdAt,
    lastMessageAt: createdAt,
    lastMessagePreview: buildMessagePreview(normalizedBody),
    lastMessageSenderId: input.senderId,
    unreadCounts: nextUnreadCounts,
    lastReadAt: nextLastReadAt,
  });
}

export async function markDirectConversationRead(input: { conversationId: string; userId: string }) {
  const conversation = await getDirectMessageConversation(input.conversationId);

  if (!conversation) {
    throw new Error("That conversation is unavailable.");
  }

  if (!conversation.participantIds.includes(input.userId)) {
    throw new Error("You do not have access to that conversation.");
  }

  const nextUnreadCounts = { ...(conversation.unreadCounts || {}), [input.userId]: 0 };
  const nextLastReadAt = { ...(conversation.lastReadAt || {}), [input.userId]: new Date().toISOString() };

  await patchFirestoreDocument(`dmConversations/${input.conversationId}`, {
    unreadCounts: nextUnreadCounts,
    lastReadAt: nextLastReadAt,
    updatedAt: new Date(),
  });
}
