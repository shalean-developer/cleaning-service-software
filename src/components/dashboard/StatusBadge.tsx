import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
};

const softToneClasses: Record<StatusBadgeTone, string> = {
  neutral: "bg-zinc-50 text-zinc-700 ring-zinc-200/70",
  info: "bg-sky-50 text-sky-800 ring-sky-200/60",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200/60",
  warning: "bg-amber-50 text-amber-900 ring-amber-200/60",
  danger: "bg-red-50 text-red-800 ring-red-200/60",
};

type Props = {
  label: string;
  tone?: StatusBadgeTone;
  variant?: "default" | "soft";
};

export function StatusBadge({ label, tone = "neutral", variant = "default" }: Props) {
  const palette = variant === "soft" ? softToneClasses : toneClasses;
  const ring = variant === "soft" ? "ring-1 ring-inset" : "";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${palette[tone]} ${ring}`}
    >
      {label}
    </span>
  );
}
