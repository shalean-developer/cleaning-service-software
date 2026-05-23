import type { Metadata } from "next";
import { CustomerHubShell } from "@/components/dashboard/customer/CustomerHubShell";
import { CustomerPaymentHistoryPanel } from "@/components/dashboard/customer/CustomerPaymentHistoryPanel";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Payment history | Customer",
  description: "View booking payments, invoice payments, and approved saved-card charges.",
};

export default async function CustomerPaymentsPage() {
  const user = await getCurrentUser();
  const accountLabel = user?.authUser.email?.split("@")[0] ?? "Your account";

  return (
    <CustomerHubShell accountLabel={accountLabel} showLiveBadge={false}>
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Payment history</h1>
          <p className="mt-1 text-sm text-zinc-600">
            View your booking payments, invoice payments, and approved saved-card charges.
          </p>
        </div>
        <CustomerPaymentHistoryPanel />
      </div>
    </CustomerHubShell>
  );
}
