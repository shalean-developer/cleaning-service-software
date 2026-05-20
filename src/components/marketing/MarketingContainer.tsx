import type { ReactNode } from "react";

type MarketingContainerProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
};

export function MarketingContainer({
  children,
  className = "",
  as: Tag = "div",
}: MarketingContainerProps) {
  return <Tag className={`marketing-container ${className}`.trim()}>{children}</Tag>;
}
