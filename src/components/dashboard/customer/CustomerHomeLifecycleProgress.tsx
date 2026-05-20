import {
  customerHomeLifecycleSteps,
  type CustomerHomeLifecycleStep,
} from "@/features/dashboards/customerHomeDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import { UI_CARD_SHELL_CLASS, UI_SECTION_TITLE_CLASS } from "@/lib/ui/productUiTokens";

type Props = {
  status: BookingStatus;
};

function StepMarker({ state }: { state: CustomerHomeLifecycleStep["state"] }) {
  if (state === "complete") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-zinc-900 bg-white text-xs font-semibold text-zinc-900"
        aria-hidden
      >
        ⋯
      </span>
    );
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs text-zinc-400"
      aria-hidden
    >
      ○
    </span>
  );
}

export function CustomerHomeLifecycleProgress({ status }: Props) {
  const steps = customerHomeLifecycleSteps(status);

  return (
    <section className={`${UI_CARD_SHELL_CLASS} px-4 py-4 sm:px-5 sm:py-4`}>
      <h2 className={UI_SECTION_TITLE_CLASS}>Booking progress</h2>

      {/* Desktop: horizontal stepper */}
      <ol className="mt-4 hidden gap-2 sm:flex sm:items-start sm:justify-between">
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {index < steps.length - 1 ? (
              <span
                className={`absolute left-[calc(50%+14px)] top-3 h-px w-[calc(100%-28px)] ${
                  step.state === "complete" ? "bg-zinc-300" : "bg-zinc-100"
                }`}
                aria-hidden
              />
            ) : null}
            <StepMarker state={step.state} />
            <p
              className={`mt-2 max-w-[8.5rem] text-xs leading-snug ${
                step.state === "current"
                  ? "font-semibold text-zinc-900"
                  : step.state === "complete"
                    ? "font-medium text-zinc-600"
                    : "text-zinc-400"
              }`}
            >
              {step.label}
            </p>
          </li>
        ))}
      </ol>

      {/* Mobile: vertical stack */}
      <ol className="mt-3 space-y-0 sm:hidden">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
              {!isLast ? (
                <span
                  className={`absolute left-[11px] top-6 h-[calc(100%-8px)] w-px ${
                    step.state === "complete" ? "bg-zinc-300" : "bg-zinc-100"
                  }`}
                  aria-hidden
                />
              ) : null}
              <StepMarker state={step.state} />
              <p
                className={`pt-0.5 text-sm leading-snug ${
                  step.state === "current"
                    ? "font-semibold text-zinc-900"
                    : step.state === "complete"
                      ? "font-medium text-zinc-600"
                      : "text-zinc-400"
                }`}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
