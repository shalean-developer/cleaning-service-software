import type { Metadata } from "next";
import { CustomerHubShell } from "@/components/dashboard/customer/CustomerHubShell";
import { CustomerPaymentMethodsPanel } from "@/components/dashboard/customer/CustomerPaymentMethodsPanel";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isZohoSavedMethodsEnabled } from "@/features/zoho-invoice-payments/server/zohoPaymentLaunchGuard";

export const metadata: Metadata = {
  title: "Saved payment methods | Customer",
  description: "View and manage saved payment methods for Zoho invoice payments.",
};

export default async function CustomerPaymentMethodsPage() {
  const user = await getCurrentUser();
  const accountLabel = user?.authUser.email?.split("@")[0] ?? "Your account";
  const savedMethodsEnabled = isZohoSavedMethodsEnabled();

  return (
    <CustomerHubShell accountLabel={accountLabel} showLiveBadge={false}>
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Saved payment methods</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Manage cards you saved for future approved Shalean invoice payments.
          </p>
        </div>
        {savedMethodsEnabled ? (
          <CustomerPaymentMethodsPanel />
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-700">
            Saved payment methods are temporarily unavailable. You can still pay invoices using
            Paystack checkout when online invoice payments are enabled.
          </div>
        )}
      </div>
    </CustomerHubShell>
  );
}
