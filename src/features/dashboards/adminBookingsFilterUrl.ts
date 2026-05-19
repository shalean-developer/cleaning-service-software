export type AdminBookingsUrlParams = {
  filter?: string;
  q?: string;
  from?: string;
  to?: string;
};

export function buildAdminBookingsQueryParams(
  current: AdminBookingsUrlParams,
  overrides: Partial<AdminBookingsUrlParams> = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const next: AdminBookingsUrlParams = {
    filter: current.filter || undefined,
    q: current.q || undefined,
    from: current.from || undefined,
    to: current.to || undefined,
    ...overrides,
  };

  if ("filter" in overrides && overrides.filter === undefined) {
    delete next.filter;
  }

  for (const [key, value] of Object.entries(next)) {
    if (value) {
      params.set(key, value);
    }
  }
  return params;
}

export function buildAdminBookingsHref(
  current: AdminBookingsUrlParams,
  overrides: Partial<AdminBookingsUrlParams> = {},
): string {
  const qs = buildAdminBookingsQueryParams(current, overrides).toString();
  return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
}
