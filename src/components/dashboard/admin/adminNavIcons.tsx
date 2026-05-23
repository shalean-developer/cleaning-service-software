import type { ReactElement, ReactNode } from "react";

type IconProps = {
  className?: string;
};

const STROKE = {
  width: 1.5,
  cap: "round" as const,
  join: "round" as const,
};

/** Shared 24×24 stroke icon shell. consistent weight and optical alignment. */
function strokeIcon(className: string | undefined, children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE.width}
      strokeLinecap={STROKE.cap}
      strokeLinejoin={STROKE.join}
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function AdminBrandIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      <path d="M10 10h4v4h-4z" />
    </>
  ));
}

export function AdminNavHomeIcon({ className }: IconProps) {
  return strokeIcon(className, <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />);
}

export function AdminNavCleanersIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c0-3.038 2.91-5.5 6.5-5.5s6.5 2.462 6.5 5.5" />
    </>
  ));
}

export function AdminNavBookingsIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </>
  ));
}

export function AdminNavAssignmentsIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <rect x="7" y="3" width="10" height="4" rx="1" />
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <path d="M9 11h6M9 14.5h6M9 18h4" />
    </>
  ));
}

export function AdminNavAnalyticsIcon({ className }: IconProps) {
  return strokeIcon(className, <path d="M5 19V11M12 19V6M19 19v-8" />);
}

export function AdminNavTeamSupportIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <path d="M3 11h3a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H3z" />
      <path d="M21 11h-3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3z" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ));
}

export function AdminNavNotificationsIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ));
}

export function AdminNavPayoutsIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c0-1.38-1.12-2.5-2.5-2.5S9.5 8.12 9.5 9.5s1.12 2.5 2.5 2.5 2.5 1.12 2.5 2.5 2.5-1.12 2.5-2.5 2.5" />
      <path d="M12 7.5v9" />
    </>
  ));
}

export function AdminSignOutIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M14 12H4M18 8l4 4-4 4" />
    </>
  ));
}

export function AdminChevronDownIcon({ className }: IconProps) {
  return strokeIcon(className, <path d="m6 9 6 6 6-6" />);
}

export function AdminNavCustomersIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <path d="M4 20v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
      <circle cx="12" cy="8" r="3.5" />
    </>
  ));
}

export function AdminNavDispatchIcon({ className }: IconProps) {
  return AdminNavAssignmentsIcon({ className });
}

export function AdminNavSupportIcon({ className }: IconProps) {
  return strokeIcon(className, (
    <>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </>
  ));
}

const ADMIN_NAV_ICON_BY_HREF: Record<string, (props: IconProps) => ReactElement> = {
  "/admin": AdminNavHomeIcon,
  "/admin/cleaners": AdminNavCleanersIcon,
  "/admin/customers": AdminNavCustomersIcon,
  "/admin/bookings": AdminNavBookingsIcon,
  "/admin/support": AdminNavSupportIcon,
  "/admin/assignments": AdminNavAssignmentsIcon,
  "/admin/analytics/assignments": AdminNavAnalyticsIcon,
  "/admin/analytics/team-support": AdminNavTeamSupportIcon,
  "/admin/notifications": AdminNavNotificationsIcon,
  "/admin/operations/zoho-payments": AdminNavPayoutsIcon,
  "/admin/payouts": AdminNavPayoutsIcon,
  "/customer/book": AdminNavBookingsIcon,
  "/admin/customers/new": AdminNavCustomersIcon,
};

export function AdminNavIcon({ href, className }: { href: string; className?: string }) {
  const Icon = ADMIN_NAV_ICON_BY_HREF[href] ?? AdminNavHomeIcon;
  return <Icon className={className} />;
}
