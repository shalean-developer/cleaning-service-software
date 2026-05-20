type SectionEyebrowProps = {
  children: string;
  className?: string;
};

export function SectionEyebrow({ children, className = "" }: SectionEyebrowProps) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-wide text-blue-600 ${className}`}
    >
      {children}
    </p>
  );
}
