import type { Metadata } from "next";
import { CustomerHubShell } from "@/components/dashboard/customer/CustomerHubShell";
import { CustomerMonthlyInvoicesPanel } from "@/components/dashboard/customer/CustomerMonthlyInvoicesPanel";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Monthly invoices | Customer",
  description: "View and pay your consolidated monthly cleaning invoices.",
};

export default async function CustomerInvoicesPage() {
  const user = await getCurrentUser();
  const accountLabel = user?.authUser.email?.split("@")[0] ?? "Your account";

  return (
    <CustomerHubShell accountLabel={accountLabel} showLiveBadge={false}>
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Monthly invoices</h1>
          <p className="mt-1 text-sm text-zinc-600">
            View your consolidated monthly cleaning invoices and pay securely online.
          </p>
        </div>
        <CustomerMonthlyInvoicesPanel />
      </div>
    </CustomerHubShell>
  );
}
