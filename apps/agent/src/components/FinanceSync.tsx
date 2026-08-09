"use client";

import { useState } from "react";

export function FinanceSync() {
  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-09");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sync() {
    setLoading(true);
    setStatus("Fetching posted transactions from Plaid…");
    try {
      const response = await fetch("/api/finance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const result = (await response.json()) as {
        transactionsSaved?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Sync failed");
      setStatus(`Saved ${result.transactionsSaved ?? 0} posted transactions.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="block text-black/60 dark:text-white/60">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block text-black/60 dark:text-white/60">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void sync()}
        disabled={loading}
        className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20"
      >
        {loading ? "Syncing…" : "Run posted-transaction sync"}
      </button>
      {status ? (
        <p className="text-sm text-black/60 dark:text-white/60" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
