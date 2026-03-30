import { getGoogleAccessToken } from "./google-service-account";

const realtimeDatabaseUrl =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  "https://ride-app-dd741-default-rtdb.firebaseio.com/";

function buildRealtimeDatabaseUrl(path: string) {
  const trimmedBase = realtimeDatabaseUrl.replace(/\/+$/, "");
  const normalizedPath = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${trimmedBase}/${normalizedPath || ""}.json`;
}

async function performRealtimeDatabaseRequest<T>(
  path: string,
  init: RequestInit & { body?: string }
) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(buildRealtimeDatabaseUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Could not access Realtime Database path ${path}: ${details || response.statusText}`
    );
  }

  return (await response.json().catch(() => null)) as T;
}

export async function getRealtimeDatabaseValue<T>(path: string) {
  return performRealtimeDatabaseRequest<T | null>(path, {
    method: "GET",
  });
}

export async function setRealtimeDatabaseValue<T>(path: string, value: T) {
  return performRealtimeDatabaseRequest<T>(path, {
    method: "PUT",
    body: JSON.stringify(value),
  });
}

export async function updateRealtimeDatabaseValue<T extends Record<string, unknown>>(
  path: string,
  value: Partial<T>
) {
  return performRealtimeDatabaseRequest<T>(path, {
    method: "PATCH",
    body: JSON.stringify(value),
  });
}

export async function pushRealtimeDatabaseValue<T>(path: string, value: T) {
  return performRealtimeDatabaseRequest<{ name: string }>(path, {
    method: "POST",
    body: JSON.stringify(value),
  });
}

export async function deleteRealtimeDatabaseValue(path: string) {
  return performRealtimeDatabaseRequest<null>(path, {
    method: "DELETE",
  });
}
