"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { BookingSupportRequestType } from "@/lib/database/types";
import {
  BOOKING_SUPPORT_COPY,
  listAvailableBookingSupportActions,
  parseBookingSupportQueryParam,
  requestTypeFromSupportQuery,
  type BookingSupportActionContext,
} from "@/features/bookings/server/bookingSupportRequestTypes";
import type { BookingSupportRequestSummary } from "@/features/bookings/server/bookingSupportRequestsService";

type Props = {
  bookingId: string;
  seriesId: string | null;
  actionContext: BookingSupportActionContext;
  initialRequests: BookingSupportRequestSummary[];
  initialSupportQuery: string | null;
};

export function CustomerBookingSupportPanel({
  bookingId,
  seriesId,
  actionContext,
  initialRequests,
  initialSupportQuery,
}: Props) {
  const router = useRouter();
  const actions = useMemo(
    () => listAvailableBookingSupportActions(actionContext),
    [actionContext],
  );

  const [requests, setRequests] = useState(initialRequests);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);
  const [activeType, setActiveType] = useState<BookingSupportRequestType | null>(null);
  const [message, setMessage] = useState("");
  const [preferredNewTime, setPreferredNewTime] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openForm = (type: BookingSupportRequestType) => {
    setActiveType(type);
    setError(null);
    setSuccess(null);
    if (type !== "cancel") setConfirmCancel(false);
  };

  useEffect(() => {
    const query = parseBookingSupportQueryParam(initialSupportQuery);
    if (!query) return;
    const type = requestTypeFromSupportQuery(query);
    if (actions.some((a) => a.id === type)) {
      openForm(type);
    }
  }, [initialSupportQuery, actions]);

  async function submit() {
    if (!activeType) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/customer/bookings/${bookingId}/support-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: activeType,
          message,
          preferredNewTime: preferredNewTime || undefined,
          confirmCancel: activeType === "cancel" ? confirmCancel : undefined,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        requestId?: string;
      };
      if (!body.ok) {
        setError(body.message ?? "Could not submit request.");
        return;
      }
      setSuccess(body.message ?? "Request submitted.");
      setActiveType(null);
      setMessage("");
      setPreferredNewTime("");
      setConfirmCancel(false);
      router.refresh();
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  const activeAction = actions.find((a) => a.id === activeType);

  return (
    <section
      id="booking-support"
      className="scroll-mt-20 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"
      aria-labelledby="booking-support-heading"
    >
      <h2 id="booking-support-heading" className="text-sm font-semibold text-zinc-900">
        Support
      </h2>
      <p className="mt-1 text-sm text-zinc-600">{BOOKING_SUPPORT_COPY.panelIntro}</p>

      {actionContext.isSeriesVisit ? (
        <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-sm text-sky-900">
          {BOOKING_SUPPORT_COPY.recurringRedirectNote}{" "}
          <Link
            href={
              seriesId
                ? `/customer/bookings/recurring/${seriesId}`
                : "/customer/bookings/recurring"
            }
            className="font-semibold text-shalean-primary underline-offset-2 hover:underline"
          >
            Manage recurring schedule
          </Link>
        </p>
      ) : null}

      {success ? <p className="mt-3 text-sm text-emerald-800">{success}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => openForm(action.id)}
            className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-3.5 text-sm font-medium transition-colors ${
              action.id === "cancel"
                ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                : "border-zinc-200 text-zinc-800 hover:bg-zinc-50"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>

      {activeType && activeAction ? (
        <div className="mt-4 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
          <p className="text-sm font-medium text-zinc-900">{activeAction.label}</p>
          <p className="text-sm text-zinc-600">{activeAction.description}</p>

          {activeType === "reschedule" ? (
            <label className="block text-sm text-zinc-700">
              <span className="font-medium">Preferred new date &amp; time</span>
              <input
                type="datetime-local"
                value={preferredNewTime}
                onChange={(e) => setPreferredNewTime(e.target.value)}
                className="mt-1 w-full max-w-sm rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
            </label>
          ) : null}

          {activeType !== "cancel" ? (
            <label className="block text-sm text-zinc-700">
              <span className="font-medium">Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="How can we help?"
              />
            </label>
          ) : (
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={confirmCancel}
                onChange={(e) => setConfirmCancel(e.target.checked)}
                className="mt-1"
              />
              <span>
                I understand this is a cancellation request and our team will review before
                confirming — not an instant cancel.
              </span>
            </label>
          )}

          {error ? <p className="text-sm text-red-800">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void submit()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-shalean-primary px-4 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Submit request
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setActiveType(null);
                setError(null);
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {requests.length > 0 ? (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Your requests
          </h3>
          <ul className="mt-2 space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900">{r.requestTypeLabel}</span>
                  <span className="text-xs font-medium text-zinc-500">{r.statusLabel}</span>
                </div>
                {r.preferredNewTime ? (
                  <p className="mt-1 text-xs text-zinc-600">
                    Preferred: {new Date(r.preferredNewTime).toLocaleString("en-ZA")}
                  </p>
                ) : null}
                {r.message ? (
                  <p className="mt-1 text-xs text-zinc-600">&ldquo;{r.message}&rdquo;</p>
                ) : null}
                <p className="mt-1 text-[11px] text-zinc-400">
                  {new Date(r.createdAt).toLocaleString("en-ZA")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
