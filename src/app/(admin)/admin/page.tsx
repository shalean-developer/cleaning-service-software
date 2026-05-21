import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/getCurrentUser";

import { adminOverviewLoader } from "@/features/dashboards/server/adminOverviewReadModel";

import { AdminHomeOperationsCenter } from "@/components/dashboard/admin/AdminHomeOperationsCenter";

import { AdminOverviewSkeleton } from "@/components/dashboard/admin/overview/AdminOverviewSkeleton";

import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";

import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";



export const metadata: Metadata = {

  title: "Admin | Cleaning Services",

};



export default async function AdminHomePage() {

  const user = await getCurrentUser();

  const overview = user ? await adminOverviewLoader(user) : null;



  return (

    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>

      {overview?.ok ? (

        <AdminHomeOperationsCenter

          referenceNow={overview.data.referenceNow}

          queues={overview.data.queues}

          cronSummary={overview.data.cronSummary}

          criticalCronJobs={overview.data.criticalCronJobs}

          deferredDiagnostics={overview.data.deferredDiagnostics}

          assignmentWorkQueueTotal={overview.data.assignmentWorkQueueTotal}

          snapshot={overview.data.snapshot}

          snapshotPresentation={overview.data.snapshotPresentation}

          liveFeed={overview.data.liveFeed}

          dispatchAlerts={overview.data.dispatchAlerts}

          supportRows={overview.data.supportRows}

          rhythm={overview.data.rhythm}

          payoutView={overview.data.payoutView}

        />

      ) : (

        <AdminOverviewSkeleton />

      )}

    </AdminDashboardShell>

  );

}

