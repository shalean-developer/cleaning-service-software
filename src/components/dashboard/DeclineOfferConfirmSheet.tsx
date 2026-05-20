"use client";

import { useEffect, useId, useRef } from "react";

export type DeclineOfferConfirmSummary = {
  serviceLabel: string;
  scheduleLabel: string;
  earningsLabel: string;
};

type Props = DeclineOfferConfirmSummary & {
  open: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function DeclineOfferConfirmSheet({
  open,
  loading,
  error,
  onClose,
  onConfirm,
  serviceLabel,
  scheduleLabel,
  earningsLabel,
  returnFocusRef,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const returnFocusEl = returnFocusRef?.current ?? null;
    cancelButtonRef.current?.focus();

    return () => {
      if (returnFocusEl) {
        returnFocusEl.focus();
      } else {
        previousFocus?.focus();
      }
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!loading) onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusables.length === 0) return;

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, loading]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={() => {
          if (!loading) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl motion-reduce:transition-none md:rounded-2xl"
      >
        <h2 id={titleId} className="text-base font-semibold text-zinc-900">
          Decline this job offer?
        </h2>
        <div id={descriptionId} className="mt-2 space-y-2 text-sm text-zinc-600">
          <p>You won&apos;t be assigned to this cleaning job.</p>
          <p>This job may be offered to another cleaner.</p>
        </div>
        <section className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <p className="font-medium text-zinc-900">{serviceLabel}</p>
          <p className="mt-1 text-zinc-600">{scheduleLabel}</p>
          <p className="mt-2 text-zinc-800">
            <span className="text-zinc-500">Your earnings: </span>
            {earningsLabel}
          </p>
        </section>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <section className="mt-6 flex flex-col gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            data-decline-cancel
            disabled={loading}
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
          >
            Keep offer
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-50"
          >
            {loading ? "Declining…" : "Decline offer"}
          </button>
        </section>
      </div>
    </div>
  );
}
