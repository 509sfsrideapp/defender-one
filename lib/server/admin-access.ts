import { isAdminEmail } from "../admin";
import { verifyFirebaseIdToken } from "./firebase-auth";

export type VerifiedAdminToken = Awaited<ReturnType<typeof verifyFirebaseIdToken>>;

export function getBearerTokenFromHeaders(headers: Headers) {
  const header = headers.get("authorization") || headers.get("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function verifyAdminRequest(headers: Headers) {
  const idToken = getBearerTokenFromHeaders(headers);

  if (!idToken) {
    throw new Error("Missing admin token.");
  }

  const decoded = await verifyFirebaseIdToken(idToken);

  if (!isAdminEmail(decoded.email)) {
    throw new Error("Admin access required.");
  }

  return decoded;
}
