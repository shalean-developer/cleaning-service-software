import { ADMIN_RUNBOOKS, type AdminRunbookKey } from "@/features/dashboards/server/adminRunbooks";

type Props = {
  runbookKey: AdminRunbookKey;
  className?: string;
};

/** Read-only reference to an ops markdown doc in the repository. */
export function AdminRunbookRef({ runbookKey, className = "" }: Props) {
  const runbook = ADMIN_RUNBOOKS[runbookKey];
  return (
    <p className={`text-sm text-zinc-600 ${className}`.trim()}>
      <span className="font-medium text-zinc-800">Runbook:</span> {runbook.title}
      <span className="mt-0.5 block font-mono text-xs text-zinc-500">{runbook.docPath}</span>
    </p>
  );
}
