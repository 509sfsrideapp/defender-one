import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "../../../lib/server/firebase-auth";
import { writeAuditLog } from "../../../lib/server/audit-log";
import {
  createFirestoreDocument,
  getFirestoreDocument,
} from "../../../lib/server/firestore-admin";
import { listIsoRequestsWithCreators } from "../../../lib/server/iso";
import {
  ISO_ITEM_CATEGORY_OPTIONS,
  ISO_POST_TYPE_OPTIONS,
  ISO_SERVICE_CATEGORY_OPTIONS,
  ISO_URGENCY_OPTIONS,
  type IsoCategory,
  type IsoPostType,
  type IsoUrgency,
} from "../../../lib/iso";

type IsoCreatorSeedProfile = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rank?: string | null;
};

type RequestBody = {
  title?: string;
  postType?: IsoPostType;
  category?: IsoCategory;
  location?: string;
  address?: string | null;
  description?: string;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
  quantityText?: string | null;
  neededByDate?: string | null;
  urgency?: IsoUrgency;
};

function isValidOption<T extends string>(
  value: string,
  options: Array<{ value: T }>
): value is T {
  return options.some((option) => option.value === value);
}

function getSafeIsoError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("quota exceeded") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("\"code\": 429")
  ) {
    return "ISO is temporarily unavailable right now. Give it a moment and try again.";
  }

  return message || fallback;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing user token." }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const body = (await request.json()) as RequestBody;
    const title = body.title?.trim() || "";
    const description = body.description?.trim() || "";
    const postType = body.postType?.trim() || "";
    const category = body.category?.trim() || "";
    const location = body.location?.trim() || "";
    const urgency = body.urgency?.trim() || "";
    const rawPhotoUrls = Array.isArray(body.photoUrls) ? body.photoUrls : [];
    const normalizedPhotoUrls = rawPhotoUrls
      .map((photoUrl) => (typeof photoUrl === "string" ? photoUrl.trim() : ""))
      .filter(Boolean)
      .slice(0, 3);
    const photoUrl = normalizedPhotoUrls[0] || body.photoUrl?.trim() || null;

    if (!title) {
      return NextResponse.json({ error: "Request title is required." }, { status: 400 });
    }

    if (!location) {
      return NextResponse.json({ error: "Location is required." }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    if (!isValidOption(postType, ISO_POST_TYPE_OPTIONS)) {
      return NextResponse.json({ error: "Choose a valid post type." }, { status: 400 });
    }

    const validCategoryOptions =
      postType === "service" ? ISO_SERVICE_CATEGORY_OPTIONS : ISO_ITEM_CATEGORY_OPTIONS;

    if (!isValidOption(category, validCategoryOptions)) {
      return NextResponse.json({ error: "Choose a valid category." }, { status: 400 });
    }

    if (!isValidOption(urgency, ISO_URGENCY_OPTIONS)) {
      return NextResponse.json({ error: "Choose a valid urgency." }, { status: 400 });
    }

    const creatorProfile = await getFirestoreDocument<IsoCreatorSeedProfile>(`users/${decoded.sub}`);

    const createdDocument = (await createFirestoreDocument("isoRequests", {
      title,
      postType,
      category,
      location,
      address: body.address?.trim() || null,
      description,
      photoUrl,
      photoUrls: normalizedPhotoUrls,
      quantityText: body.quantityText?.trim() || null,
      neededByDate: body.neededByDate?.trim() || null,
      urgency,
      status: "open",
      createdByUid: decoded.sub,
      createdByEmail: decoded.email || null,
      createdByName: creatorProfile?.name ?? null,
      createdByFirstName: creatorProfile?.firstName ?? null,
      createdByLastName: creatorProfile?.lastName ?? null,
      createdByRank: creatorProfile?.rank ?? null,
      createdAt: new Date(),
    })) as { name?: string };

    const requestId = createdDocument.name?.split("/").pop() || "";

    if (!requestId) {
      throw new Error("ISO request was created without an ID.");
    }

    await writeAuditLog({
      action: "iso.request.create",
      actor: { uid: decoded.sub, email: decoded.email || null },
      targetType: "isoRequest",
      targetId: requestId,
      status: "success",
      message: "Created ISO request.",
      details: {
        category,
        hasAddress: Boolean(body.address?.trim()),
        hasPhoto: Boolean(photoUrl),
        postType,
        urgency,
      },
    });

    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: getSafeIsoError(error, "Could not create the ISO request."),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Missing user token." }, { status: 401 });
    }

    await verifyFirebaseIdToken(idToken);
    const payload = await listIsoRequestsWithCreators();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: getSafeIsoError(error, "Could not load ISO requests."),
      },
      { status: 500 }
    );
  }
}
