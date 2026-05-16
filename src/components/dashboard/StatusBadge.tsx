import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
};

type Props = {
  label: string;
  tone?: StatusBadgeTone;
};

export function StatusBadge({ label, tone = "neutral" }: Props) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
