"use client";

import { AdminAccountBlock } from "@/components/dashboard/admin/AdminAccountBlock";
import { AdminBrandBlock } from "@/components/dashboard/admin/AdminBrandBlock";
import { AdminOperationsSidebarToggle } from "@/components/dashboard/admin/AdminOperationsSidebar";

type Props = {
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
};

export function AdminDashboardHeader({ sidebarOpen, onSidebarOpenChange }: Props) {
  return (
    <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/85">
      <header className="flex min-h-[3.75rem] items-center gap-2 px-3 sm:px-4">
        <AdminOperationsSidebarToggle
          open={sidebarOpen}
          onToggle={() => onSidebarOpenChange(!sidebarOpen)}
        />
        <div className="min-w-0 flex-1">
          <AdminBrandBlock />
        </div>
        <AdminAccountBlock />
      </header>
    </div>
  );
}
