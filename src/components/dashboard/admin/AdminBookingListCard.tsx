import Link from "next/link";
import type { ReactNode } from "react";
import { AdminBookingBadgeRow } from "@/components/dashboard/admin/AdminBookingBadgeRow";
import { ADMIN_LIST_CARD_CLASS } from "@/features/dashboards/adminDisplay";
import { UI_LIST_META_CLASS, UI_LIST_TITLE_CLASS } from "@/lib/ui/productUiTokens";

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
      <AdminBookingBadgeRow badges={badges} />
      <p className={`mt-2 ${UI_LIST_TITLE_CLASS}`}>{title}</p>
      <p className={`mt-0.5 ${UI_LIST_META_CLASS}`}>{meta}</p>
      {secondary ? <p className={`mt-0.5 text-xs ${UI_LIST_META_CLASS} text-zinc-500`}>{secondary}</p> : null}
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
      <AdminBookingBadgeRow badges={badges} />
      <p className={`mt-2 ${UI_LIST_TITLE_CLASS}`}>{title}</p>
      <p className={`mt-0.5 ${UI_LIST_META_CLASS}`}>{meta}</p>
      {children}
    </Link>
  );
}
