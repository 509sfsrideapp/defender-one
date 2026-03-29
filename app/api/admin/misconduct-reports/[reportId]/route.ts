import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "../../../../../lib/server/admin-access";
import { writeAuditLog } from "../../../../../lib/server/audit-log";
import { resolveMisconductReport } from "../../../../../lib/server/misconduct";

type RequestBody = {
  action?: "allow" | "delete";
  message?: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) {
  try {
    const adminToken = await verifyAdminRequest(request.headers);
    const { reportId } = await context.params;
    const body = (await request.json()) as RequestBody;
    const action = body.action;

    if (!reportId || (action !== "allow" && action !== "delete")) {
      return NextResponse.json({ error: "reportId and a valid action are required." }, { status: 400 });
    }

    const resolvedReport = await resolveMisconductReport({
      reportId,
      action,
      message: body.message || "",
      resolvedByUid: adminToken.sub,
      resolvedByEmail: adminToken.email || null,
    });

    await writeAuditLog({
      action: `misconduct.report.${action}`,
      actor: { uid: adminToken.sub, email: adminToken.email },
      targetType: resolvedReport.targetType,
      targetId: resolvedReport.targetId,
      status: "success",
      message: `Resolved misconduct report ${reportId} with action ${action}.`,
      details: {
        targetLabel: resolvedReport.targetLabel,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not resolve misconduct report." },
      { status: 500 }
    );
  }
}
