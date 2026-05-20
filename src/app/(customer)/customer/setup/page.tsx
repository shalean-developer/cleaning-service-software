import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import {
  checkCustomerReadiness,
  homePathForRole,
  resolvePostSignInPath,
} from "@/lib/auth";
import { CustomerSetupRetryForm } from "./CustomerSetupRetryForm";

export const metadata: Metadata = {
  title: "Finish account setup | Customer",
  description: "Complete your Shalean customer account setup",
};

type PageProps = {
  searchParams: Promise<{ redirectedFrom?: string }>;
};

export default async function CustomerSetupPage({ searchParams }: PageProps) {
  const { redirectedFrom } = await searchParams;
  const readiness = await checkCustomerReadiness();

  if (readiness.status === "wrong_role") {
    redirect(homePathForRole(readiness.user.role));
  }

  if (readiness.status === "ready") {
    redirect(resolvePostSignInPath("customer", redirectedFrom));
  }

  return (
    <DashboardShell
      title="Finish your account setup"
      subtitle="We need a moment to prepare your customer account before you can book or view bookings."
      nav={[
        { href: "/customer", label: "Home" },
        { href: "/customer/bookings", label: "Bookings" },
        { href: "/customer/book", label: "Book a clean" },
      ]}
      headerEnd={<CustomerDashboardHeaderEndLoader />}
    >
      <section className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-700">
          Your sign-in is active, but your customer account is not ready yet. This usually
          resolves automatically. Use the button below to retry setup, then we will take you
          back to where you left off.
        </p>
        <CustomerSetupRetryForm redirectedFrom={redirectedFrom ?? null} />
      </section>
    </DashboardShell>
  );
}
