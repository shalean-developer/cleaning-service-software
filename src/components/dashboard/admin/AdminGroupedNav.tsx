"use client";

import type { NavItem } from "@/components/dashboard/DashboardShell";
import { AdminNavItem } from "@/components/dashboard/admin/AdminNavItem";
import type { AdminNavGroup } from "@/features/dashboards/adminNav";

const GROUP_LABEL_CLASS =
  "hidden text-[9px] font-semibold uppercase leading-none tracking-wider text-zinc-400 md:block";

const GROUP_SEPARATOR_CLASS = "mx-1 hidden h-9 w-px shrink-0 bg-zinc-200/90 sm:block";

const MOBILE_SECTION_LABEL_CLASS =
  "px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 first:pt-1";

type DesktopProps = {
  home: NavItem;
  groups: readonly AdminNavGroup[];
  pathname: string | null;
};

type MobileProps = DesktopProps & {
  onNavigate: () => void;
};

function NavGroupCluster({
  group,
  pathname,
  layout,
  onNavigate,
}: {
  group: AdminNavGroup;
  pathname: string | null;
  layout: "bar" | "menu";
  onNavigate?: () => void;
}) {
  if (layout === "menu") {
    return (
      <li>
        <p className={MOBILE_SECTION_LABEL_CLASS}>{group.label}</p>
        <ul className="flex flex-col gap-0.5">
          {group.items.map((item) => (
            <li key={item.href}>
              <AdminNavItem
                {...item}
                pathname={pathname}
                layout="menu"
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-col items-center gap-0.5"
      role="presentation"
      aria-label={group.label}
    >
      <span className={GROUP_LABEL_CLASS}>{group.label}</span>
      <div className="flex items-end gap-0.5">
        {group.items.map((item) => (
          <AdminNavItem key={item.href} {...item} pathname={pathname} layout="bar" />
        ))}
      </div>
    </div>
  );
}

export function AdminGroupedNavDesktop({ home, groups, pathname }: DesktopProps) {
  return (
    <div className="mx-auto flex min-w-max items-end justify-center gap-1 py-1 md:gap-1.5">
      <div className="flex shrink-0 items-end pr-1">
        <AdminNavItem {...home} pathname={pathname} layout="bar" emphasis="primary" />
      </div>

      <span className={GROUP_SEPARATOR_CLASS} aria-hidden />

      {groups.map((group, index) => (
        <div key={group.id} className="flex shrink-0 items-end">
          {index > 0 ? <span className={GROUP_SEPARATOR_CLASS} aria-hidden /> : null}
          <NavGroupCluster group={group} pathname={pathname} layout="bar" />
        </div>
      ))}
    </div>
  );
}

export function AdminGroupedNavMobile({ home, groups, pathname, onNavigate }: MobileProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      <li>
        <AdminNavItem
          {...home}
          pathname={pathname}
          layout="menu"
          onNavigate={onNavigate}
        />
      </li>
      {groups.map((group) => (
        <NavGroupCluster
          key={group.id}
          group={group}
          pathname={pathname}
          layout="menu"
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}
