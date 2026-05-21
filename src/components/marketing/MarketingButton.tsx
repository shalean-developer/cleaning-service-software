import Link from "next/link";
import type { ReactNode } from "react";

type MarketingButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "white";
  className?: string;
  external?: boolean;
  "aria-label"?: string;
};

const variantClasses: Record<NonNullable<MarketingButtonProps["variant"]>, string> = {
  primary:
    "bg-shalean-primary text-white shadow-md shadow-blue-500/20 hover:bg-blue-600",
  secondary:
    "border-2 border-shalean-border bg-white text-shalean-navy hover:border-shalean-primary hover:text-shalean-primary",
  ghost: "text-shalean-navy hover:bg-shalean-soft-blue",
  white: "bg-white text-shalean-primary shadow-sm hover:bg-blue-50",
};

export function MarketingButton({
  href,
  children,
  variant = "primary",
  className = "",
  external = false,
  "aria-label": ariaLabel,
}: MarketingButtonProps) {
  const classes = `marketing-focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all duration-200 ${variantClasses[variant]} ${className}`;

  if (external) {
    return (
      <a
        href={href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
