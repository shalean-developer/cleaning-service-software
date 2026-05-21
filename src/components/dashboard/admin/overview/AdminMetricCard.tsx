import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  /** Muted context line at the bottom of the card. */
  footer: string;
  icon: LucideIcon;
  emphasize?: boolean;
  /** Optional green trend line (e.g. "+11% wow"). */
  trend?: string;
  /** Optional line between value and footer (e.g. "1 critical", "of 18 on duty"). */
  secondary?: string;
};

export function AdminMetricCard({
  label,
  value,
  footer,
  icon: Icon,
  emphasize = false,
  trend,
  secondary,
}: Props) {
  return (
    <article
      className={`group flex min-h-[8.5rem] flex-col rounded-xl border px-4 py-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-md ${
        emphasize
          ? "border-red-200/90 bg-red-50/50 hover:border-red-300"
          : "border-slate-200/70 bg-white hover:border-slate-300/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            emphasize ? "text-red-600/90" : "text-slate-500"
          }`}
        >
          {label}
        </p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            emphasize ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"
          }`}
          aria-hidden
        >
          <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
        </span>
      </div>

      <p
        className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight ${
          emphasize ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>

      {trend ? (
        <p className="mt-1 text-xs font-medium text-emerald-600">{trend}</p>
      ) : secondary ? (
        <p
          className={`mt-1 text-xs font-medium ${
            emphasize ? "text-red-600" : "text-slate-500"
          }`}
        >
          {secondary}
        </p>
      ) : (
        <span className="mt-1 block min-h-[1rem]" aria-hidden />
      )}

      <p className="mt-auto pt-2 text-xs leading-snug text-slate-500">{footer}</p>
    </article>
  );
}
