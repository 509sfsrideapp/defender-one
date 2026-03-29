"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { auth } from "./firebase";
import type {
  DirectMessageBucket,
  DirectMessageConversationRecord,
  DirectMessageConversationType,
} from "./direct-messages";

type OpenConversationRequest =
  | {
      type: "direct";
      otherUserId: string;
    }
  | {
      type: "marketplace";
      targetId: string;
    }
  | {
      type: "iso";
      targetId: string;
    };

type OpenConversationResponse = {
  ok: true;
  conversation: DirectMessageConversationRecord;
  bucket: DirectMessageBucket;
};

async function getCurrentUserToken() {
  const idToken = await auth.currentUser?.getIdToken();

  if (!idToken) {
    throw new Error("You need to sign in again before opening messages.");
  }

  return idToken;
}

export async function ensureDirectMessageConversation(
  request: OpenConversationRequest
) {
  const idToken = await getCurrentUserToken();
  const response = await fetch("/api/messages/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | { error?: string }
    | OpenConversationResponse;

  if (!response.ok || !("ok" in payload)) {
    const errorMessage = "error" in payload ? payload.error : undefined;
    throw new Error(errorMessage || "Could not open that conversation.");
  }

  return payload;
}

export function openConversationInMessages(
  router: AppRouterInstance,
  bucket: DirectMessageConversationType,
  conversationId: string
) {
  const searchParams = new URLSearchParams();
  searchParams.set("tab", bucket);
  searchParams.set("conversationId", conversationId);
  router.push(`/messages?${searchParams.toString()}`);
}

export async function openDirectMessage(
  router: AppRouterInstance,
  otherUserId: string
) {
  const payload = await ensureDirectMessageConversation({
    type: "direct",
    otherUserId,
  });
  openConversationInMessages(router, "direct", payload.conversation.id);
}

export async function openMarketplaceConversation(
  router: AppRouterInstance,
  listingId: string
) {
  const payload = await ensureDirectMessageConversation({
    type: "marketplace",
    targetId: listingId,
  });
  openConversationInMessages(router, "marketplace", payload.conversation.id);
}

export async function openIsoConversation(
  router: AppRouterInstance,
  requestId: string
) {
  const payload = await ensureDirectMessageConversation({
    type: "iso",
    targetId: requestId,
  });
  openConversationInMessages(router, "iso", payload.conversation.id);
}
