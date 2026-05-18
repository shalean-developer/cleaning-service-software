import type { ReactNode } from "react";
import { WizardStepper } from "@/features/booking-wizard/components/WizardStepper";
import {
  getWizardShellClass,
  WIZARD_MAIN_COLUMN_CLASS,
} from "@/features/booking-wizard/wizardLayout";
import { PaymentVerifyingPanel } from "./PaymentReturnPanels";

type Props = {
  children: ReactNode;
};

/** Booking wizard shell for payment return — presentation only. */
export function PaymentVerificationShell({ children }: Props) {
  return (
    <div className={getWizardShellClass("checkout")}>
      <header className={`mb-4 ${WIZARD_MAIN_COLUMN_CLASS}`}>
        <h1 className="text-xl font-semibold text-zinc-900">Book a clean</h1>
        <p className="text-sm text-zinc-600">Shalean Cleaning Services</p>
      </header>

      <div className={WIZARD_MAIN_COLUMN_CLASS}>
        <WizardStepper current="checkout" />
      </div>

      <main
        className={`flex flex-1 flex-col items-center justify-center py-8 md:py-12 ${WIZARD_MAIN_COLUMN_CLASS}`}
      >
        {children}
      </main>
    </div>
  );
}

type PanelProps = {
  children: ReactNode;
  busy?: boolean;
};

export function PaymentVerificationPanel({ children, busy }: PanelProps) {
  return (
    <section
      className="w-[90%] max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] sm:w-full sm:p-10 md:max-w-[32.5rem]"
      aria-busy={busy === true ? true : undefined}
    >
      {children}
    </section>
  );
}

export function PaymentVerificationLoadingFallback() {
  return (
    <PaymentVerificationShell>
      <PaymentVerificationPanel busy>
        <PaymentVerifyingPanel statusMessage="Confirming payment…" />
      </PaymentVerificationPanel>
    </PaymentVerificationShell>
  );
}
