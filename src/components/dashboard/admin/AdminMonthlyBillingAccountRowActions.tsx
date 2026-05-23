"use client";

import Link from "next/link";
import type { CustomerBillingAccountListItem } from "@/features/monthly-billing/server/customerBillingAccountReadModel";

type Props = {
  row: CustomerBillingAccountListItem;
};

export function AdminMonthlyBillingAccountRowActions({ row }: Props) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      data-testid="monthly-billing-row-actions"
    >
      {!row.monthlyAccountEnabled ? (
        <Link
          href={`/admin/customers/${row.customerId}`}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Enable
        </Link>
      ) : null}
      {row.account ? (
        <>
          <Link
            href={`/admin/customers/${row.customerId}`}
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Terms
          </Link>
          <Link
            href={`/admin/customers/${row.customerId}`}
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Zoho
          </Link>
          {row.monthlyAccountEnabled ? (
            <Link
              href={`/admin/customers/${row.customerId}`}
              className="rounded border border-red-200 px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-50"
            >
              Disable
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
