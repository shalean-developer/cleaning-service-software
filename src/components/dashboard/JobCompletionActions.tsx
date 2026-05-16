"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  status: string;
};

export function JobCompletionActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"start" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, action: "start" | "complete") {
    setLoading(action);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const record = body as Record<string, unknown>;
        setError(
          typeof record.message === "string"
            ? record.message
            : `Could not ${action} job.`,
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(null);
    }
  }

  if (status === "assigned") {
    return (
      <section className="mt-4">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => call(`/api/cleaner/jobs/${bookingId}/start`, "start")}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading === "start" ? "Starting…" : "Start job"}
        </button>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }

  if (status === "in_progress") {
    return (
      <section className="mt-4">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => call(`/api/cleaner/jobs/${bookingId}/complete`, "complete")}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading === "complete" ? "Completing…" : "Mark complete"}
        </button>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }

  return null;
}
