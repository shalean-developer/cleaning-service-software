"use client";

import { CustomerProfileMenu } from "@/components/dashboard/customer/CustomerProfileMenu";
import type { CustomerProfileMenuProps } from "@/components/dashboard/customer/CustomerProfileMenu";
import { WIZARD_MAIN_COLUMN_CLASS, WIZARD_PAGE_HEADER_CLASS } from "../wizardLayout";

type Props = {
  profileMenu: CustomerProfileMenuProps;
};

export function BookingWizardPageHeader({ profileMenu }: Props) {
  return (
    <header
      className={`${WIZARD_PAGE_HEADER_CLASS} ${WIZARD_MAIN_COLUMN_CLASS} flex items-start justify-between gap-3`}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold text-zinc-900">Book a clean</h1>
        <p className="text-sm text-zinc-600">Shalean Cleaning Services</p>
      </div>
      <CustomerProfileMenu {...profileMenu} />
    </header>
  );
}
