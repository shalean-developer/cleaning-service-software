import Link from "next/link";
import type { JSX } from "react";
import { IconGrid, IconHome } from "./icons";

export type BreadcrumbIconId = "home" | "services";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: BreadcrumbIconId;
};

const BREADCRUMB_ICONS: Record<
  BreadcrumbIconId,
  ({ className }: { className?: string }) => JSX.Element
> = {
  home: IconHome,
  services: IconGrid,
};

type MarketingBreadcrumbsProps = {
  items: BreadcrumbItem[];
};

function BreadcrumbLabel({ item, isLast }: { item: BreadcrumbItem; isLast: boolean }) {
  const Icon = item.icon ? BREADCRUMB_ICONS[item.icon] : null;
  const content = (
    <span className="inline-flex items-center gap-1.5">
      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden /> : null}
      <span>{item.label}</span>
    </span>
  );

  if (isLast || !item.href) {
    return (
      <span className={isLast ? "font-medium text-shalean-navy" : undefined}>{content}</span>
    );
  }

  return (
    <Link
      href={item.href}
      className="marketing-focus-ring rounded text-slate-600 transition hover:text-shalean-primary"
    >
      {content}
    </Link>
  );
}

export function MarketingBreadcrumbs({ items }: MarketingBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span className="text-slate-300" aria-hidden>
                  /
                </span>
              ) : null}
              <BreadcrumbLabel item={item} isLast={isLast} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
