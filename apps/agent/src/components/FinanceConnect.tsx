"use client";

import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export function FinanceConnect() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSuccess = useCallback(async (publicToken: string | null) => {
    if (!publicToken) {
      setStatus("Plaid did not return a connection token.");
      return;
    }
    setLoading(true);
    setStatus("Saving your encrypted connection…");
    try {
      const response = await fetch("/api/finance/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      const result = (await response.json()) as {
        institutionName?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Connection failed");
      setStatus(
        result.institutionName
          ? `Connected to ${result.institutionName}.`
          : "Financial institution connected.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (error) => {
      if (error) setStatus("Plaid Link exited before the connection completed.");
    },
  });

  async function startLink() {
    setLoading(true);
    setStatus("Starting Plaid Link…");
    try {
      const response = await fetch("/api/finance/link-token", { method: "POST" });
      const result = (await response.json()) as { linkToken?: string; error?: string };
      if (!response.ok || !result.linkToken) {
        throw new Error(result.error ?? "Unable to start Plaid Link");
      }
      setLinkToken(result.linkToken);
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start Plaid Link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => (linkToken && ready ? open() : void startLink())}
        disabled={loading || (Boolean(linkToken) && !ready)}
        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "Working…" : linkToken && ready ? "Open Plaid Link" : "Connect Chase through Plaid"}
      </button>
      {status ? (
        <p className="text-sm text-black/60 dark:text-white/60" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
