"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  canMarkParticipation: boolean;
  hasMarkedParticipation: boolean;
};

export function SupportParticipationActions({
  bookingId,
  canMarkParticipation,
  hasMarkedParticipation,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (hasMarkedParticipation) {
    return (
      <p className="mt-3 text-sm font-medium text-emerald-800">
        Support participation recorded.
      </p>
    );
  }

  if (!canMarkParticipation) return null;

  async function confirmParticipation() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cleaner/jobs/${bookingId}/support-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportNote: note.trim() || undefined,
        }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const record = body as Record<string, unknown>;
        setError(
          typeof record.message === "string"
            ? record.message
            : "Could not record participation.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-4 space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-zinc-600">
          Optional note for operations
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Anything ops should know about your support on this job"
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
        />
      </label>
      <button
        type="button"
        disabled={loading}
        onClick={confirmParticipation}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.12)] disabled:opacity-50 sm:w-auto"
      >
        {loading ? "Saving…" : "Confirm I helped"}
      </button>
      {error ? (
        <p
          className="rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
