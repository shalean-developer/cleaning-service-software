import type { AdminCleanerNetworkViewFilter } from "./adminCleanersNetworkDisplay";

export type AdminCleanersNetworkUrlParams = {
  view?: string;
  q?: string;
};

export function buildAdminCleanersNetworkHref(
  current: AdminCleanersNetworkUrlParams,
  overrides: Partial<AdminCleanersNetworkUrlParams> = {},
): string {
  const params = new URLSearchParams();
  const next: AdminCleanersNetworkUrlParams = {
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
  return query ? `/admin/cleaners?${query}` : "/admin/cleaners";
}

export const ADMIN_CLEANERS_NETWORK_VIEW_CHIPS: {
  id: AdminCleanerNetworkViewFilter;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "on_visit", label: "On visit" },
  { id: "top_performers", label: "Top performers" },
  { id: "paused", label: "Paused" },
];
