import Link from "next/link";
import {
  ADMIN_BOOKINGS_PRESETS,
  isAdminBookingsPresetActive,
} from "@/features/dashboards/adminBookingsPresets";
import { buildAdminBookingsHref } from "@/features/dashboards/adminBookingsFilterUrl";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import { UI_FILTER_CHIP_NAV_CLASS } from "@/lib/ui/productUiTokens";

type Props = {
  filter?: AdminBookingFilter;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
};

function presetChipClass(active: boolean): string {
  const base =
    "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";
  return active
    ? `${base} border-zinc-900 bg-zinc-900 text-white`
    : `${base} border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50`;
}

export function AdminBookingsFilterPresets({
  filter,
  search,
  scheduledFrom,
  scheduledTo,
}: Props) {
  const current = {
    filter,
    q: search,
    from: scheduledFrom,
    to: scheduledTo,
  };

  return (
    <nav
      aria-label="Booking list presets"
      className={UI_FILTER_CHIP_NAV_CLASS}
    >
      {ADMIN_BOOKINGS_PRESETS.map((preset) => {
        const active = isAdminBookingsPresetActive(preset, filter);
        const href = buildAdminBookingsHref(current, {
          filter: preset.filter,
          q: search,
          from: scheduledFrom,
          to: scheduledTo,
        });

        return (
          <Link
            key={preset.id}
            href={href}
            aria-current={active ? "true" : undefined}
            className={presetChipClass(active)}
          >
            {preset.label}
          </Link>
        );
      })}
    </nav>
  );
}
