import { CLEANER_DETAIL_INSET_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";

type Props = {
  message: string;
};

/** Shown on support-role job detail when start/complete actions are not available. */
export function CleanerSupportJobNotice({ message }: Props) {
  return (
    <div className={`${CLEANER_DETAIL_INSET_CLASS} px-4 py-3`}>
      <p className="text-sm leading-relaxed text-zinc-600">{message}</p>
    </div>
  );
}
