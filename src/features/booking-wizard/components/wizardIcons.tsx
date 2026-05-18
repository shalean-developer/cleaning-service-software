type IconProps = {
  className?: string;
};

export function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 1.2 9.9 5.6l4.7.4-3.6 3.1 1.1 4.6L8 11.4 3.9 13.7l1.1-4.6-3.6-3.1 4.7-.4L8 1.2Z" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M6 8V6a4 4 0 1 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="4.5"
        y="8"
        width="11"
        height="8.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
