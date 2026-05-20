import { DASHBOARD_LOADING_SR_LABEL } from "@/lib/app/dashboardEcosystemDisplay";
import {
  UI_SKELETON_LIST_CARD_CLASS,
  UI_SKELETON_PULSE_CLASS,
} from "@/lib/ui/productUiTokens";
import { WIZARD_SHELL_WIDE_CLASS } from "@/features/booking-wizard/wizardLayout";

function PulseBlock({ className }: { className: string }) {
  return <span className={`${UI_SKELETON_PULSE_CLASS} ${className}`} aria-hidden />;
}

/** Lightweight booking wizard shell skeleton (perceived speed on route transitions). */
export function BookingWizardPageSkeleton() {
  return (
    <section
      className={WIZARD_SHELL_WIDE_CLASS}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{DASHBOARD_LOADING_SR_LABEL}</span>
      <PulseBlock className="mb-3 h-4 w-32" />
      <PulseBlock className="mb-2 h-3 w-24 md:hidden" />
      <PulseBlock className="mb-1 h-5 w-40 md:hidden" />
      <div className="mb-4 hidden gap-1 md:flex">
        {Array.from({ length: 7 }, (_, i) => (
          <PulseBlock key={i} className="h-8 flex-1" />
        ))}
      </div>
      <section className={UI_SKELETON_LIST_CARD_CLASS}>
        <PulseBlock className="h-6 w-2/5 max-w-xs" />
        <PulseBlock className="mt-4 h-10 w-full" />
        <PulseBlock className="mt-3 h-10 w-full" />
        <PulseBlock className="mt-3 h-10 w-3/4 max-w-md" />
      </section>
      <div className="mt-6 flex justify-between gap-3 md:mt-8">
        <PulseBlock className="h-11 w-24" />
        <PulseBlock className="h-11 w-28" />
      </div>
    </section>
  );
}
