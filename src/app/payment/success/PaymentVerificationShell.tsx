import type { ReactNode } from "react";
import { PAYMENT_VERIFY_STATUS_MESSAGE } from "@/lib/app/dashboardEcosystemDisplay";
import { PaymentVerifyingPanel } from "./PaymentReturnPanels";
import { PaymentCustomerShell } from "./PaymentCustomerShell";

type Props = {
  children: ReactNode;
};

/** @deprecated Wizard chrome — use {@link PaymentCustomerShell} for customer payment return. */
export function PaymentVerificationShell({ children }: Props) {
  return (
    <PaymentCustomerShell title="Confirming payment" subtitle="Securing your booking with Shalean">
      {children}
    </PaymentCustomerShell>
  );
}

type PanelProps = {
  children: ReactNode;
  busy?: boolean;
};

export function PaymentVerificationPanel({ children, busy }: PanelProps) {
  return (
    <section
      className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] sm:p-10 md:max-w-[32.5rem]"
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
        <PaymentVerifyingPanel statusMessage={PAYMENT_VERIFY_STATUS_MESSAGE} />
      </PaymentVerificationPanel>
    </PaymentVerificationShell>
  );
}
