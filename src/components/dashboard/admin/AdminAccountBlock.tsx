"use client";

import {
  AdminProfileMenu,
  type AdminProfileMenuProps,
} from "@/components/dashboard/admin/AdminProfileMenu";

export function AdminAccountBlock(props: AdminProfileMenuProps) {
  return <AdminProfileMenu {...props} />;
}
