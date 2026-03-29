import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../../lib/server/admin-access";
import { listMisconductReports } from "../../../../lib/server/misconduct";

export async function GET(request: NextRequest) {
  try {
    await verifyAdminRequest(request.headers);
    const items = await listMisconductReports();
    return NextResponse.json({ items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load misconduct reports." },
      { status: 500 }
    );
  }
}
