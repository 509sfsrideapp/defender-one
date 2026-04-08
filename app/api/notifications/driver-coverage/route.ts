import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "../../../../lib/admin";
import { verifyFirebaseIdToken } from "../../../../lib/server/firebase-auth";
import { runDriverCoverageAlertMonitor } from "../../../../lib/server/driver-coverage-alerts";

function requestHasCronAccess(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: NextRequest) {
  try {
    if (!requestHasCronAccess(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await runDriverCoverageAlertMonitor({
      origin: new URL(request.url).origin,
    });

    return NextResponse.json({ ok: true, mode: "cron", summary });
  } catch (error) {
    console.error("Driver coverage cron failed", error);
    return NextResponse.json({ error: "Could not run the driver coverage monitor." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);

    if (!isAdminEmail(decoded.email)) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const summary = await runDriverCoverageAlertMonitor({
      origin: new URL(request.url).origin,
    });

    return NextResponse.json({ ok: true, mode: "manual", summary });
  } catch (error) {
    console.error("Driver coverage manual run failed", error);
    return NextResponse.json({ error: "Could not run the driver coverage monitor." }, { status: 500 });
  }
}
