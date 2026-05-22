import Link from "next/link";
import { supportRequestTypeDisclaimer } from "@/features/support/server/supportNotificationTemplates";

export type CustomerSupportRequestTimelineItem = {
  id: string;
  requestTypeLabel: string;
  requestType: string;
  status: string;
  statusLabel: string;
  message: string | null;
  preferredNewTime?: string | null;
  customerResponse: string | null;
  createdAt: string;
  statusChangedAt: string;
  resolvedAt: string | null;
};

const TIMELINE_STEPS = [
  { key: "submitted", label: "Submitted", statuses: ["open", "acknowledged", "resolved", "rejected"] },
  { key: "acknowledged", label: "Acknowledged", statuses: ["acknowledged", "resolved", "rejected"] },
  { key: "closed", label: "Resolved / Rejected", statuses: ["resolved", "rejected"] },
] as const;

function stepReached(stepStatuses: readonly string[], current: string): boolean {
  return stepStatuses.includes(current);
}

function closedLabel(status: string): string {
  if (status === "rejected") return "Rejected";
  if (status === "resolved") return "Resolved";
  return "Resolved / Rejected";
}

type Props = {
  requests: CustomerSupportRequestTimelineItem[];
  contactHref?: string;
};

export function CustomerSupportRequestTimeline({ requests, contactHref }: Props) {
  if (requests.length === 0) return null;

  return (
    <div className="mt-5 border-t border-zinc-100 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Your requests
      </h3>
      <p className="mt-1 text-xs text-zinc-600">
        This request does not change your booking until our team confirms it.
      </p>
      <ul className="mt-3 space-y-4">
        {requests.map((r) => {
          const disclaimer = supportRequestTypeDisclaimer(r.requestType);
          const isUnresolved = r.status === "open" || r.status === "acknowledged";
          return (
            <li
              key={r.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">{r.requestTypeLabel}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                  {r.statusLabel}
                </span>
              </div>

              <ol className="mt-3 flex gap-1">
                {TIMELINE_STEPS.map((step, index) => {
                  const label =
                    step.key === "closed" ? closedLabel(r.status) : step.label;
                  const active = stepReached(step.statuses, r.status);
                  return (
                    <li
                      key={step.key}
                      className={`flex-1 rounded-md px-1 py-1.5 text-center text-[10px] font-medium leading-tight ${
                        active ? "bg-shalean-primary/10 text-shalean-primary" : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {label}
                      {index < TIMELINE_STEPS.length - 1 ? null : null}
                    </li>
                  );
                })}
              </ol>

              <p className="mt-2 text-[11px] text-zinc-500">
                Submitted {new Date(r.createdAt).toLocaleString("en-ZA")}
                {r.status !== "open" ? (
                  <>
                    {" "}
                    · Updated {new Date(r.statusChangedAt).toLocaleString("en-ZA")}
                  </>
                ) : null}
              </p>

              {r.preferredNewTime ? (
                <p className="mt-1 text-xs text-zinc-600">
                  Preferred: {new Date(r.preferredNewTime).toLocaleString("en-ZA")}
                </p>
              ) : null}
              {r.message ? (
                <p className="mt-1 text-xs text-zinc-600">&ldquo;{r.message}&rdquo;</p>
              ) : null}
              {disclaimer ? (
                <p className="mt-2 text-xs text-amber-900/90">{disclaimer}</p>
              ) : null}
              {r.customerResponse ? (
                <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-xs text-zinc-800 ring-1 ring-zinc-100">
                  <span className="font-medium">Team response: </span>
                  {r.customerResponse}
                </p>
              ) : null}
              {isUnresolved && contactHref ? (
                <p className="mt-2 text-xs">
                  <Link href={contactHref} className="font-medium text-shalean-primary underline">
                    Contact support
                  </Link>{" "}
                  if you need to add details.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
