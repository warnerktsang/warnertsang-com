import { getCurrentUser } from "@/lib/auth-guard";
import { syncPlaidTransactions } from "@/lib/finance/service";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as {
    startDate?: string;
    endDate?: string;
  };
  if (!body.startDate || !body.endDate) {
    return Response.json(
      { error: "startDate and endDate are required" },
      { status: 400 },
    );
  }

  try {
    const result = await syncPlaidTransactions({
      userId: user.id,
      startDate: body.startDate,
      endDate: body.endDate,
    });
    await recordAudit({
      userId: user.id,
      type: "finance_sync",
      action: "Synced posted Plaid transactions",
      success: true,
      metadata: {
        provider: "plaid",
        requestedStart: result.requestedStart,
        requestedEnd: result.requestedEnd,
        transactionsSeen: result.transactionsSeen,
        transactionsSaved: result.transactionsSaved,
      },
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Financial sync failed";
    await recordAudit({
      userId: user.id,
      type: "finance_sync_error",
      action: "Failed to sync Plaid transactions",
      success: false,
      metadata: { message },
    });
    const status = message.includes("Date range") || message.includes("must be") ? 400 : 502;
    return Response.json({ error: status === 400 ? message : "Financial sync failed" }, { status });
  }
}
