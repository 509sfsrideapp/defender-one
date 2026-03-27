import { getGoogleAccessToken } from "./google-service-account";

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { timestampValue: string };

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

export type FirestoreUserDoc = {
  id: string;
  available?: boolean;
  name?: string;
  email?: string;
  flight?: string;
  notificationTokens?: string[];
  notificationTokenMap?: Record<string, string>;
};

export type FirestoreRideDoc = {
  id: string;
  riderId?: string;
  acceptedBy?: string;
  status?: string;
  riderName?: string;
  riderFlight?: string;
  pickup?: string;
  driverName?: string;
  carYear?: string;
  carMake?: string;
  carModel?: string;
  carColor?: string;
  createdAt?: string;
  dispatchMode?: string;
  dispatchFlight?: string;
  dispatchExpandedAt?: string;
};

const projectId = "ride-app-dd741";

function parseValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(parseValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nestedValue]) => [key, parseValue(nestedValue)])
    );
  }
  return undefined;
}

function parseDocument(document: FirestoreDocument): FirestoreUserDoc {
  const id = document.name.split("/").pop() || "";
  const fields = document.fields || {};

  return {
    id,
    available: parseValue(fields.available) as boolean | undefined,
    name: parseValue(fields.name) as string | undefined,
    email: parseValue(fields.email) as string | undefined,
    flight: parseValue(fields.flight) as string | undefined,
    notificationTokens: (parseValue(fields.notificationTokens) as string[] | undefined) || [],
    notificationTokenMap: (parseValue(fields.notificationTokenMap) as Record<string, string> | undefined) || {},
  };
}

function getPreferredNotificationTokens(user: FirestoreUserDoc) {
  const mappedTokens = Object.values(user.notificationTokenMap || {}).filter(Boolean);

  if (mappedTokens.length > 0) {
    return Array.from(new Set(mappedTokens));
  }

  return Array.from(new Set((user.notificationTokens || []).filter(Boolean)));
}

export async function getAvailableDriverNotificationTokens(options?: {
  includeFlight?: string | null;
  excludeFlight?: string | null;
}) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "users" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "available" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Could not load available drivers for notifications.");
  }

  const data = (await response.json()) as Array<{ document?: FirestoreDocument }>;

  return data
    .map((entry) => (entry.document ? parseDocument(entry.document) : null))
    .filter((entry): entry is FirestoreUserDoc => Boolean(entry))
    .filter((entry) => {
      const entryFlight = entry.flight?.trim() || null;
      const includeFlight = options?.includeFlight?.trim() || null;
      const excludeFlight = options?.excludeFlight?.trim() || null;

      if (includeFlight && entryFlight !== includeFlight) {
        return false;
      }

      if (excludeFlight && entryFlight === excludeFlight) {
        return false;
      }

      return true;
    })
    .flatMap((entry) => getPreferredNotificationTokens(entry));
}

export async function getUserNotificationTokens(userId: string) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Could not load notification target user.");
  }

  const document = (await response.json()) as FirestoreDocument;
  const parsed = parseDocument(document);
  return getPreferredNotificationTokens(parsed);
}

export async function getUserDoc(userId: string) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Could not load user document.");
  }

  const document = (await response.json()) as FirestoreDocument;
  return parseDocument(document);
}

export async function getRideDoc(rideId: string) {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rides/${rideId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Could not load ride for notifications.");
  }

  const document = (await response.json()) as FirestoreDocument;
  const fields = document.fields || {};

  return {
    id: document.name.split("/").pop() || rideId,
    riderId: parseValue(fields.riderId) as string | undefined,
    acceptedBy: parseValue(fields.acceptedBy) as string | undefined,
    status: parseValue(fields.status) as string | undefined,
    riderName: parseValue(fields.riderName) as string | undefined,
    riderFlight: parseValue(fields.riderFlight) as string | undefined,
    pickup: parseValue(fields.pickup) as string | undefined,
    driverName: parseValue(fields.driverName) as string | undefined,
    carYear: parseValue(fields.carYear) as string | undefined,
    carMake: parseValue(fields.carMake) as string | undefined,
    carModel: parseValue(fields.carModel) as string | undefined,
    carColor: parseValue(fields.carColor) as string | undefined,
    createdAt: parseValue(fields.createdAt) as string | undefined,
    dispatchMode: parseValue(fields.dispatchMode) as string | undefined,
    dispatchFlight: parseValue(fields.dispatchFlight) as string | undefined,
    dispatchExpandedAt: parseValue(fields.dispatchExpandedAt) as string | undefined,
  } satisfies FirestoreRideDoc;
}
