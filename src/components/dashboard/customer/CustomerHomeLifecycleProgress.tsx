import Link from "next/link";
import {
  customerHubVisitStatusSteps,
  type CustomerHubVisitStatusStep,
} from "@/features/dashboards/customerHubDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  status: BookingStatus;
  bookingDetailHref: string;
};

function HubStepMarker({ state }: { state: CustomerHubVisitStatusStep["state"] }) {
  if (state === "complete") {
    return (
      <span
        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-shalean-primary text-[11px] font-semibold text-white shadow-sm"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-shalean-primary bg-white"
        aria-hidden
      >
        <span className="h-2.5 w-2.5 rounded-full bg-shalean-primary" />
      </span>
    );
  }
  return (
    <span
      className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white"
      aria-hidden
    />
  );
}

export function CustomerHomeLifecycleProgress({ status, bookingDetailHref }: Props) {
  const steps = customerHubVisitStatusSteps(status);

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-medium text-shalean-navy">Visit status</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Live progress updates</p>
        </div>
        <Link
          href={bookingDetailHref}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path strokeLinecap="round" d="M12 3v3m0 12v3M5 12H2m20 0h-3M7 7 5 5m14 14-2-2M7 17l-2 2m14-14-2 2" />
          </svg>
          Advance
        </Link>
      </div>

      <ol className="relative mt-6 hidden items-start justify-between sm:flex">
        <span
          className="absolute left-[12%] right-[12%] top-4 h-0.5 bg-blue-100"
          aria-hidden
        />
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            <HubStepMarker state={step.state} />
            <p
              className={`mt-2 max-w-[7rem] text-xs leading-snug ${
                step.state === "current"
                  ? "font-semibold text-shalean-navy"
                  : step.state === "complete"
                    ? "font-medium text-zinc-600"
                    : "text-zinc-400"
              }`}
            >
              {step.label}
            </p>
            {step.state === "current" && index === steps.length - 1 ? (
              <Link
                href={bookingDetailHref}
                className="mt-1 text-[11px] font-medium text-shalean-primary hover:underline"
              >
                Tap to view step detail
              </Link>
            ) : null}
          </li>
        ))}
      </ol>

      <ol className="relative mt-4 space-y-4 sm:hidden">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3">
            <HubStepMarker state={step.state} />
            <p
              className={`text-sm ${
                step.state === "current" ? "font-semibold text-shalean-navy" : "text-zinc-600"
              }`}
            >
              {step.label}
            </p>
          </li>
        ))}
        <li>
          <Link href={bookingDetailHref} className="text-xs font-medium text-shalean-primary hover:underline">
            Tap to view step detail
          </Link>
        </li>
      </ol>
    </section>
  );
}
