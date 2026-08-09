import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { FinanceConnect } from "@/components/FinanceConnect";
import { FinanceSync } from "@/components/FinanceSync";

export const dynamic = "force-dynamic";

export default async function FinanceConnectPage() {
  await requireUser();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-black/50 dark:text-white/50">Agent OS</p>
          <h1 className="text-2xl font-semibold">Connect Chase</h1>
        </div>
        <Link
          href="/admin"
          className="text-sm text-black/60 hover:underline dark:text-white/60"
        >
          Back to admin
        </Link>
      </header>
      <section className="space-y-4 rounded-2xl border border-black/10 p-5 dark:border-white/15">
        <p className="text-sm leading-6 text-black/70 dark:text-white/70">
          Connect your Chase credit card through Plaid. Your Chase credentials
          stay in Plaid&apos;s hosted flow, and the Agent OS stores only an
          encrypted server-side connection.
        </p>
        <FinanceConnect />
      </section>
      <section className="space-y-4 rounded-2xl border border-black/10 p-5 dark:border-white/15">
        <h2 className="font-semibold">Manual posted-transaction sync</h2>
        <p className="text-sm leading-6 text-black/70 dark:text-white/70">
          Dates are interpreted as calendar dates in America/New_York. The
          first acceptance range is August 1–9, 2026.
        </p>
        <FinanceSync />
      </section>
    </main>
  );
}
