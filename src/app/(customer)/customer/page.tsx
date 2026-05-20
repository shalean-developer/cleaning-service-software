import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerHomeContent } from "@/components/dashboard/customer/CustomerHomeContent";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";

export const metadata: Metadata = {
  title: "Home | Customer",
};

export default async function CustomerHomePage() {
  return (
    <DashboardShell nav={[...CUSTOMER_DASHBOARD_NAV]}>
      <CustomerHomeContent />
    </DashboardShell>
  );
}
