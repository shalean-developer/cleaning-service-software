import type { ReactNode } from "react";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  /** Collapse verbose sections by default (audit, webhooks, notifications). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  tone?: "default" | "ops";
};

function toneClasses(tone: NonNullable<Props["tone"]>): string {
  if (tone === "ops") {
    return "border-amber-200/80";
  }
  return "border-zinc-200";
}

export function AdminDetailSection({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = false,
  tone = "default",
}: Props) {
  const body = (
    <>
      {description ? <p className={ADMIN_SECTION_MUTED_CLASS}>{description}</p> : null}
      <section className={description ? "mt-3" : "mt-0"}>{children}</section>
    </>
  );

  if (collapsible) {
    return (
      <details
        className={`${ADMIN_DETAIL_CARD_CLASS} border ${toneClasses(tone)} group`}
        open={defaultOpen || undefined}
      >
        <summary className="cursor-pointer list-none px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className={`${ADMIN_SECTION_TITLE_CLASS} inline-flex items-center gap-2`}>
            {title}
            <span className="text-xs font-normal text-zinc-400 group-open:hidden">Show</span>
            <span className="hidden text-xs font-normal text-zinc-400 group-open:inline">
              Hide
            </span>
          </span>
          {description ? (
            <span className={`${ADMIN_SECTION_MUTED_CLASS} block group-open:hidden`}>
              {description}
            </span>
          ) : null}
        </summary>
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3 sm:px-5">{body}</div>
      </details>
    );
  }

  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} border ${toneClasses(tone)} p-4 sm:p-5`}>
      <h2 className={ADMIN_SECTION_TITLE_CLASS}>{title}</h2>
      {body}
    </section>
  );
}
