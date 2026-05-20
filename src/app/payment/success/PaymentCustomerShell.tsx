import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

/** Customer dashboard shell for payment return (no booking wizard chrome). */
export function PaymentCustomerShell({
  children,
  title = "Payment",
  subtitle = "Confirming your booking with Shalean",
}: Props) {
  return (
    <DashboardShell title={title} subtitle={subtitle} nav={[...CUSTOMER_DASHBOARD_NAV]}>
      <section className="mx-auto flex w-full max-w-lg flex-col py-2 sm:max-w-xl">
        {children}
      </section>
    </DashboardShell>
  );
}
