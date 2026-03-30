"use client";

import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type Unsubscribe,
} from "firebase/database";
import { realtimeDb } from "./firebase";
import {
  sortDirectMessageConversations,
  type DirectMessageConversationRecord,
  type DirectMessagePresenceRecord,
  type DirectMessageRecord,
  type DirectMessageThreadPresenceRecord,
  type DirectMessageTypingRecord,
} from "./direct-messages";

type StoredConversation = Omit<DirectMessageConversationRecord, "id">;
type StoredMessage = Omit<DirectMessageRecord, "id">;

function mapConversationRecord(
  conversationId: string,
  value: StoredConversation | null | undefined
) {
  if (!value) {
    return null;
  }

  return {
    id: conversationId,
    ...value,
    participantMap:
      value.participantMap ||
      Object.fromEntries((value.participantIds || []).map((participantId) => [participantId, true as const])),
  } satisfies DirectMessageConversationRecord;
}

function mapMessageRecord(messageId: string, value: StoredMessage | null | undefined) {
  if (!value) {
    return null;
  }

  return {
    id: messageId,
    ...value,
  } satisfies DirectMessageRecord;
}

function getConversationRef(conversationId: string) {
  return ref(realtimeDb, `dmConversations/${conversationId}`);
}

function getUserConversationsRef(userId: string) {
  return ref(realtimeDb, `dmUserConversations/${userId}`);
}

function getConversationMessagesRef(conversationId: string) {
  return ref(realtimeDb, `dmMessages/${conversationId}`);
}

function getPresenceRef(userId: string) {
  return ref(realtimeDb, `dmPresence/${userId}`);
}

function getTypingRef(conversationId: string, userId?: string) {
  return ref(
    realtimeDb,
    userId ? `dmTyping/${conversationId}/${userId}` : `dmTyping/${conversationId}`
  );
}

function getThreadPresenceRef(conversationId: string, userId?: string) {
  return ref(
    realtimeDb,
    userId
      ? `dmThreadPresence/${conversationId}/${userId}`
      : `dmThreadPresence/${conversationId}`
  );
}

export function subscribeToUserDirectMessageConversations(
  userId: string,
  onChange: (conversations: DirectMessageConversationRecord[]) => void
): Unsubscribe {
  return onValue(getUserConversationsRef(userId), (snapshot) => {
    const value = (snapshot.val() || {}) as Record<string, StoredConversation>;
    const nextConversations = Object.entries(value).flatMap(([conversationId, conversation]) => {
      const mappedConversation = mapConversationRecord(conversationId, conversation);
      return mappedConversation ? [mappedConversation] : [];
    });
    onChange(sortDirectMessageConversations(nextConversations));
  });
}

export function subscribeToDirectMessageConversation(
  conversationId: string,
  onChange: (conversation: DirectMessageConversationRecord | null) => void
): Unsubscribe {
  return onValue(getConversationRef(conversationId), (snapshot) => {
    onChange(
      mapConversationRecord(
        conversationId,
        (snapshot.val() || null) as StoredConversation | null
      )
    );
  });
}

export function subscribeToDirectMessageRecords(
  conversationId: string,
  onChange: (messages: DirectMessageRecord[]) => void
): Unsubscribe {
  return onValue(getConversationMessagesRef(conversationId), (snapshot) => {
    const value = (snapshot.val() || {}) as Record<string, StoredMessage>;
    const nextMessages = Object.entries(value)
      .flatMap(([messageId, message]) => {
        const mappedMessage = mapMessageRecord(messageId, message);
        return mappedMessage ? [mappedMessage] : [];
      })
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

    onChange(nextMessages);
  });
}

export function subscribeToDirectMessagePresence(
  userId: string,
  onChange: (presence: DirectMessagePresenceRecord | null) => void
): Unsubscribe {
  return onValue(getPresenceRef(userId), (snapshot) => {
    onChange((snapshot.val() as DirectMessagePresenceRecord | null) || null);
  });
}

export function subscribeToConversationTyping(
  conversationId: string,
  onChange: (typingByUserId: Record<string, DirectMessageTypingRecord>) => void
): Unsubscribe {
  return onValue(getTypingRef(conversationId), (snapshot) => {
    onChange((snapshot.val() as Record<string, DirectMessageTypingRecord> | null) || {});
  });
}

export function subscribeToConversationThreadPresence(
  conversationId: string,
  onChange: (presenceByUserId: Record<string, DirectMessageThreadPresenceRecord>) => void
): Unsubscribe {
  return onValue(getThreadPresenceRef(conversationId), (snapshot) => {
    onChange(
      (snapshot.val() as Record<string, DirectMessageThreadPresenceRecord> | null) || {}
    );
  });
}

export async function beginDirectMessagePresenceSession(userId: string) {
  const presenceRef = getPresenceRef(userId);
  const disconnectHandler = onDisconnect(presenceRef);
  await disconnectHandler.update({
    online: false,
    currentThreadId: null,
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await update(presenceRef, {
    online: true,
    updatedAt: new Date().toISOString(),
  });

  return async () => {
    await disconnectHandler.cancel().catch(() => undefined);
    await update(presenceRef, {
      online: false,
      currentThreadId: null,
      lastActiveAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).catch(() => undefined);
  };
}

export async function setDirectMessageTypingState(input: {
  conversationId: string;
  userId: string;
  active: boolean;
  preview?: string | null;
}) {
  const typingRef = getTypingRef(input.conversationId, input.userId);

  if (!input.active) {
    await remove(typingRef);
    return;
  }

  await set(typingRef, {
    active: true,
    preview: input.preview?.trim() ? input.preview.trim().slice(0, 60) : null,
    startedAt: new Date().toISOString(),
  } satisfies DirectMessageTypingRecord);
}

export async function beginDirectMessageThreadViewingSession(input: {
  conversationId: string;
  userId: string;
}) {
  const threadPresenceRef = getThreadPresenceRef(input.conversationId, input.userId);
  const globalPresenceRef = getPresenceRef(input.userId);
  const threadDisconnect = onDisconnect(threadPresenceRef);
  const presenceDisconnect = onDisconnect(globalPresenceRef);

  await threadDisconnect.remove();
  await presenceDisconnect.update({
    currentThreadId: null,
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await set(threadPresenceRef, {
    viewing: true,
    updatedAt: new Date().toISOString(),
  } satisfies DirectMessageThreadPresenceRecord);

  await update(globalPresenceRef, {
    online: true,
    currentThreadId: input.conversationId,
    updatedAt: new Date().toISOString(),
  });

  return async () => {
    await threadDisconnect.cancel().catch(() => undefined);
    await presenceDisconnect.cancel().catch(() => undefined);
    await remove(threadPresenceRef).catch(() => undefined);
    await update(globalPresenceRef, {
      currentThreadId: null,
      lastActiveAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).catch(() => undefined);
  };
}
