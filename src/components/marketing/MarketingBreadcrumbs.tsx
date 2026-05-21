import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type MarketingBreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function MarketingBreadcrumbs({ items }: MarketingBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span className="text-slate-300" aria-hidden>
                  /
                </span>
              ) : null}
              {isLast || !item.href ? (
                <span className={isLast ? "font-medium text-shalean-navy" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="marketing-focus-ring rounded text-slate-600 transition hover:text-shalean-primary"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
