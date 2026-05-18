import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ADMIN_LIST_CARD_CLASS } from "@/features/dashboards/adminDisplay";

export type AdminBookingListCardBadge = {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

type Props = {
  href: string;
  badges: AdminBookingListCardBadge[];
  title: string;
  meta: string;
  secondary?: string;
  footnote?: string;
};

export function AdminBookingListCard({
  href,
  badges,
  title,
  meta,
  secondary,
  footnote,
}: Props) {
  return (
    <Link href={href} className={ADMIN_LIST_CARD_CLASS}>
      <section className="flex flex-wrap items-center gap-1.5">
        {badges.map((badge) => (
          <StatusBadge key={badge.label} label={badge.label} tone={badge.tone} />
        ))}
      </section>
      <p className="mt-2 text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-0.5 text-sm text-zinc-600">{meta}</p>
      {secondary ? <p className="mt-0.5 text-xs text-zinc-500">{secondary}</p> : null}
      {footnote ? (
        <p className="mt-1 font-mono text-[11px] text-zinc-400">{footnote}</p>
      ) : null}
    </Link>
  );
}

export function AdminBookingListCardShell({
  href,
  badges,
  title,
  meta,
  children,
}: {
  href: string;
  badges: AdminBookingListCardBadge[];
  title: string;
  meta: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={ADMIN_LIST_CARD_CLASS}>
      <section className="flex flex-wrap items-center gap-1.5">
        {badges.map((badge) => (
          <StatusBadge key={badge.label} label={badge.label} tone={badge.tone} />
        ))}
      </section>
      <p className="mt-2 text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-0.5 text-sm text-zinc-600">{meta}</p>
      {children}
    </Link>
  );
}
