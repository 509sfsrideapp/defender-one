import type { IsoRequestRecord } from "../iso";
import {
  getFirestoreDocument,
  queryFirestoreDocuments,
} from "./firestore-admin";

export type IsoCreatorSummary = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rank?: string | null;
};

type IsoUserDocument = IsoCreatorSummary;

export type IsoListResponse = {
  requests: IsoRequestRecord[];
  creatorDirectory: Record<string, IsoCreatorSummary>;
};

export type IsoDetailResponse = {
  request: IsoRequestRecord | null;
  creatorProfile: IsoCreatorSummary | null;
};

function toIsoCreatorSummary(
  userDocument: ({ id: string } & IsoUserDocument) | null
): IsoCreatorSummary | null {
  if (!userDocument) {
    return null;
  }

  return {
    name: userDocument.name ?? null,
    firstName: userDocument.firstName ?? null,
    lastName: userDocument.lastName ?? null,
    rank: userDocument.rank ?? null,
  };
}

export async function listIsoRequestsWithCreators(): Promise<IsoListResponse> {
  const requests = (await queryFirestoreDocuments<Omit<IsoRequestRecord, "id">>({
    collectionPath: "isoRequests",
    orderByField: "createdAt",
    direction: "DESCENDING",
    limit: 120,
  })) as IsoRequestRecord[];

  const creatorIds = Array.from(
    new Set(
      requests
        .filter(
          (request) =>
            !request.createdByName &&
            !request.createdByFirstName &&
            !request.createdByLastName &&
            !request.createdByRank
        )
        .map((request) => request.createdByUid?.trim() || "")
        .filter(Boolean)
    )
  );

  const creatorEntries = await Promise.all(
    creatorIds.map(async (creatorId) => {
      const userDocument = await getFirestoreDocument<IsoUserDocument>(`users/${creatorId}`);
      return [creatorId, toIsoCreatorSummary(userDocument)] as const;
    })
  );

  requests.forEach((request) => {
    const creatorId = request.createdByUid?.trim() || "";
    if (!creatorId) {
      return;
    }

    if (
      request.createdByName ||
      request.createdByFirstName ||
      request.createdByLastName ||
      request.createdByRank
    ) {
      creatorEntries.push([
        creatorId,
        {
          name: request.createdByName ?? null,
          firstName: request.createdByFirstName ?? null,
          lastName: request.createdByLastName ?? null,
          rank: request.createdByRank ?? null,
        },
      ] as const);
    }
  });

  return {
    requests,
    creatorDirectory: Object.fromEntries(
      creatorEntries.filter((entry): entry is readonly [string, IsoCreatorSummary] => Boolean(entry[1]))
    ),
  };
}

export async function getIsoRequestWithCreator(requestId: string): Promise<IsoDetailResponse> {
  const request = await getFirestoreDocument<Omit<IsoRequestRecord, "id">>(`isoRequests/${requestId}`);

  if (!request) {
    return {
      request: null,
      creatorProfile: null,
    };
  }

  const creatorProfile = request.createdByUid
    ? request.createdByName ||
      request.createdByFirstName ||
      request.createdByLastName ||
      request.createdByRank
      ? {
          name: request.createdByName ?? null,
          firstName: request.createdByFirstName ?? null,
          lastName: request.createdByLastName ?? null,
          rank: request.createdByRank ?? null,
        }
      : toIsoCreatorSummary(await getFirestoreDocument<IsoUserDocument>(`users/${request.createdByUid}`))
    : null;

  return {
    request: request as IsoRequestRecord,
    creatorProfile,
  };
}
