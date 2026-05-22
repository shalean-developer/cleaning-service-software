import type { AdminCustomerRegistryViewFilter } from "./adminCustomersRegistryDisplay";

export type AdminCustomersRegistryUrlParams = {
  view?: string;
  q?: string;
};

export function buildAdminCustomersRegistryHref(
  current: AdminCustomersRegistryUrlParams,
  overrides: Partial<AdminCustomersRegistryUrlParams> = {},
): string {
  const params = new URLSearchParams();
  const next: AdminCustomersRegistryUrlParams = {
    view: current.view,
    q: current.q,
    ...overrides,
  };

  if ("view" in overrides && overrides.view === undefined) {
    delete next.view;
  }
  if ("q" in overrides && overrides.q === undefined) {
    delete next.q;
  }

  if (next.view && next.view !== "all") params.set("view", next.view);
  if (next.q?.trim()) params.set("q", next.q.trim());

  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}

export const ADMIN_CUSTOMERS_REGISTRY_VIEW_CHIPS: {
  id: AdminCustomerRegistryViewFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "recurring", label: "Recurring" },
  { id: "vip", label: "VIP" },
  { id: "new", label: "New" },
  { id: "attention", label: "Attention" },
];
