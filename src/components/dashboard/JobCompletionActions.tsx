"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  status: string;
  /** Tighter layout for sticky mobile action bar. */
  compact?: boolean;
};

export function JobCompletionActions({ bookingId, status, compact = false }: Props) {
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

  const sectionClass = compact ? "mt-0" : "mt-4";
  const buttonClass =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.12)] transition-[opacity,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] sm:w-auto";

  if (status === "assigned") {
    return (
      <section className={sectionClass}>
        <button
          type="button"
          disabled={loading !== null}
          aria-busy={loading === "start"}
          onClick={() => call(`/api/cleaner/jobs/${bookingId}/start`, "start")}
          className={buttonClass}
        >
          {loading === "start" ? "Starting…" : "Start job"}
        </button>
        {error ? (
          <p
            className="mt-2 rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 transition-opacity duration-150"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  if (status === "in_progress") {
    return (
      <section className={sectionClass}>
        <button
          type="button"
          disabled={loading !== null}
          aria-busy={loading === "complete"}
          onClick={() => call(`/api/cleaner/jobs/${bookingId}/complete`, "complete")}
          className={buttonClass}
        >
          {loading === "complete" ? "Completing…" : "Mark complete"}
        </button>
        {error ? (
          <p
            className="mt-2 rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 transition-opacity duration-150"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return null;
}
