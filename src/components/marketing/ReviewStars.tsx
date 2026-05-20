import { IconStar } from "./icons";

type ReviewStarsProps = {
  rating: number;
  className?: string;
  size?: "sm" | "md";
};

export function ReviewStars({ rating, className = "", size = "md" }: ReviewStarsProps) {
  const starClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      className={`flex gap-0.5 text-amber-400 ${className}`.trim()}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <IconStar
          key={i}
          className={`${starClass} ${i < rating ? "opacity-100" : "opacity-25"}`}
        />
      ))}
    </div>
  );
}
