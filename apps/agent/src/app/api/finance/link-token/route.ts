import { getCurrentUser } from "@/lib/auth-guard";
import { createPlaidClient, createPlaidLinkTokenRequest } from "@/lib/finance/plaid";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPlaidErrorDetails(error: unknown): {
  code: string | null;
  status: number | null;
} {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return { code: null, status: null };
  }
  const response = error.response;
  if (typeof response !== "object" || response === null) {
    return { code: null, status: null };
  }
  const status =
    "status" in response && typeof response.status === "number"
      ? response.status
      : null;
  if (!("data" in response)) return { code: null, status };
  const data = response.data;
  const code =
    typeof data === "object" &&
    data !== null &&
    "error_code" in data &&
    typeof data.error_code === "string"
      ? data.error_code
      : null;
  return { code, status };
}

export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const response = await createPlaidClient().linkTokenCreate(
      createPlaidLinkTokenRequest(user.id),
    );
    return Response.json({ linkToken: response.data.link_token });
  } catch (error) {
    const message = error instanceof Error ? error.message : null;
    const { code, status } = getPlaidErrorDetails(error);
    const configurationError =
      message === "Plaid credentials are not configured" ||
      message === "Finance encryption key is not configured";
    const clientError = configurationError
      ? "Finance integration configuration is incomplete"
      : code
        ? `Plaid rejected the Link token request (${code})`
        : "Unable to start financial connection";
    console.error("[finance] Link token creation failed", {
      category: configurationError ? "configuration" : "provider",
      code,
      status,
    });
    await recordAudit({
      userId: user.id,
      type: "finance_link_token_error",
      action: "Failed to create Plaid Link token",
      success: false,
      metadata: {
        category: configurationError ? "configuration" : "provider",
        plaidErrorCode: code,
        plaidStatus: status,
      },
    });
    return Response.json({ error: clientError }, { status: 503 });
  }
}
