"use client";

import { useCallback, useState } from "react";

type Props = {
  bookingId: string;
};

type FeedbackForm = {
  confusingText: string;
  slowedDownText: string;
  paymentSucceeded: "" | "yes" | "no";
  customerUnderstood: "" | "yes" | "no";
  notes: string;
};

const EMPTY_FORM: FeedbackForm = {
  confusingText: "",
  slowedDownText: "",
  paymentSucceeded: "",
  customerUnderstood: "",
  notes: "",
};

export function AdminAssistedOperatorFeedbackPanel({ bookingId }: Props) {
  const [form, setForm] = useState<FeedbackForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/assist-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confusingText: form.confusingText.trim() || null,
          slowedDownText: form.slowedDownText.trim() || null,
          paymentSucceeded:
            form.paymentSucceeded === "yes" ? true : form.paymentSucceeded === "no" ? false : null,
          customerUnderstood:
            form.customerUnderstood === "yes"
              ? true
              : form.customerUnderstood === "no"
                ? false
                : null,
          notes: form.notes.trim() || null,
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        setError(json.message ?? "Could not save feedback.");
        return;
      }
      setSaved(true);
      setForm(EMPTY_FORM);
    } catch {
      setError("Could not save feedback.");
    } finally {
      setSaving(false);
    }
  }, [bookingId, form]);

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      data-testid="admin-assisted-operator-feedback-panel"
    >
      <h2 className="text-base font-semibold text-zinc-900">Operator feedback (optional)</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Help improve the pilot — no payment card or bank details.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">What was confusing?</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            rows={2}
            value={form.confusingText}
            onChange={(e) => setForm((prev) => ({ ...prev, confusingText: e.target.value }))}
            data-testid="admin-assisted-feedback-confusing"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">What slowed you down?</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            rows={2}
            value={form.slowedDownText}
            onChange={(e) => setForm((prev) => ({ ...prev, slowedDownText: e.target.value }))}
            data-testid="admin-assisted-feedback-slowed"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Did payment succeed?</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={form.paymentSucceeded}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  paymentSucceeded: e.target.value as FeedbackForm["paymentSucceeded"],
                }))
              }
              data-testid="admin-assisted-feedback-payment"
            >
              <option value="">Not sure / N/A</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Did customer understand the flow?</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={form.customerUnderstood}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  customerUnderstood: e.target.value as FeedbackForm["customerUnderstood"],
                }))
              }
              data-testid="admin-assisted-feedback-customer"
            >
              <option value="">Not sure / N/A</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Additional notes</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSubmit()}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          data-testid="admin-assisted-feedback-submit"
        >
          {saving ? "Saving…" : "Submit feedback"}
        </button>
        {saved ? (
          <p className="text-sm text-emerald-700" data-testid="admin-assisted-feedback-saved">
            Feedback saved — thank you.
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
