import type { AdminCustomerListItem } from "@/features/customers/server/admin/types";
import { buildAdminCustomerRegistryCardModel } from "@/features/customers/server/admin/adminCustomersRegistryDisplay";
import { AdminCustomerRegistryCard } from "@/components/dashboard/admin/customers/AdminCustomerRegistryCard";

type Props = {
  items: AdminCustomerListItem[];
};

export function AdminCustomersRegistryList({ items }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.customerId}>
          <AdminCustomerRegistryCard model={buildAdminCustomerRegistryCardModel(item)} />
        </li>
      ))}
    </ul>
  );
}
