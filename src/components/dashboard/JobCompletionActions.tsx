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
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.12)] disabled:opacity-50 sm:w-auto"
        >
          {loading === "start" ? "Starting…" : "Start job"}
        </button>
        {error ? (
          <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950" role="alert">
            {error}
          </p>
        ) : null}
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
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.12)] disabled:opacity-50 sm:w-auto"
        >
          {loading === "complete" ? "Completing…" : "Mark complete"}
        </button>
        {error ? (
          <p className="mt-2 rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return null;
}
