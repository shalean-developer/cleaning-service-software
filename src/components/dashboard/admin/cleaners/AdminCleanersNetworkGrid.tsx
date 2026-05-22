import type { AdminCleanerListItem } from "@/features/cleaners/server/admin/types";
import { buildAdminCleanerNetworkCardModel } from "@/features/cleaners/server/admin/adminCleanersNetworkDisplay";
import { AdminCleanerNetworkCard } from "@/components/dashboard/admin/cleaners/AdminCleanerNetworkCard";

type Props = {
  items: AdminCleanerListItem[];
};

export function AdminCleanersNetworkGrid({ items }: Props) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <AdminCleanerNetworkCard model={buildAdminCleanerNetworkCardModel(item)} />
        </li>
      ))}
    </ul>
  );
}
