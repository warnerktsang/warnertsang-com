import { getCurrentUser } from "@/lib/auth-guard";
import { createPlaidClient, createPlaidLinkTokenRequest } from "@/lib/finance/plaid";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const response = await createPlaidClient().linkTokenCreate(
      createPlaidLinkTokenRequest(user.id),
    );
    return Response.json({ linkToken: response.data.link_token });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create Plaid Link token";
    await recordAudit({
      userId: user.id,
      type: "finance_link_token_error",
      action: "Failed to create Plaid Link token",
      success: false,
      metadata: { message },
    });
    return Response.json({ error: "Unable to start financial connection" }, { status: 503 });
  }
}
