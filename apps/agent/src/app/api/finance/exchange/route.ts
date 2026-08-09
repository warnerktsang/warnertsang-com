import { getCurrentUser } from "@/lib/auth-guard";
import { savePlaidConnection } from "@/lib/finance/service";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as { publicToken?: string };
  if (!body.publicToken) {
    return Response.json({ error: "publicToken is required" }, { status: 400 });
  }

  try {
    const connection = await savePlaidConnection({
      userId: user.id,
      publicToken: body.publicToken,
    });
    await recordAudit({
      userId: user.id,
      type: "finance_connection",
      action: "Connected a Plaid financial institution",
      success: true,
      metadata: { provider: "plaid", institutionName: connection.institutionName },
    });
    return Response.json({
      connected: true,
      institutionName: connection.institutionName,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to connect financial institution";
    await recordAudit({
      userId: user.id,
      type: "finance_connection_error",
      action: "Failed to connect a Plaid financial institution",
      success: false,
      metadata: { message },
    });
    return Response.json({ error: "Unable to complete financial connection" }, { status: 502 });
  }
}
