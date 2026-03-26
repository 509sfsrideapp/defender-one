import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../../lib/server/admin-access";
import { listFirestoreDocuments } from "../../../../lib/server/firestore-admin";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request.headers);
    const records = await listFirestoreDocuments("auditLogs");
    const sorted = records.sort((a, b) => {
      const aTime = typeof a.createdAt === "string" ? Date.parse(a.createdAt) : 0;
      const bTime = typeof b.createdAt === "string" ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      records: sorted.slice(0, 250),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load audit log." },
      { status: 500 }
    );
  }
}
