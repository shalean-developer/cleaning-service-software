import type { PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import { getFrequencyLabel } from "../reviewDisplay";

type Props = {
  serviceLabel: string;
  serviceSlug: ServiceSlug | null;
  bedrooms: number;
  bathrooms: number;
  propertySizeSqm: number | null;
  frequency: PricingFrequency;
  showHomeSize?: boolean;
  showFrequency?: boolean;
};

function buildHomeSizeDetail(
  serviceSlug: ServiceSlug | null,
  bedrooms: number,
  bathrooms: number,
  propertySizeSqm: number | null,
): string | null {
  if (!serviceSlug || serviceSlug === "office-cleaning") {
    if (propertySizeSqm != null) return `${propertySizeSqm} sqm`;
    return null;
  }

  const bedShort = bedrooms === 1 ? "1 bed" : `${bedrooms} beds`;
  const bathShort = bathrooms === 1 ? "1 bath" : `${bathrooms} baths`;
  return `${bedShort} \u00b7 ${bathShort}`;
}

export function WizardContextStrip({
  serviceLabel,
  serviceSlug,
  bedrooms,
  bathrooms,
  propertySizeSqm,
  frequency,
  showHomeSize = true,
  showFrequency = false,
}: Props) {
  const homeDetail = showHomeSize
    ? buildHomeSizeDetail(serviceSlug, bedrooms, bathrooms, propertySizeSqm)
    : null;
  const frequencyLabel = showFrequency ? getFrequencyLabel(frequency) : null;

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-zinc-200/90 bg-zinc-50/90 px-3 py-2 text-sm leading-snug"
      aria-label="Booking context"
    >
      <span className="font-medium text-sky-800">{serviceLabel}</span>
      {homeDetail ? (
        <>
          <span className="text-zinc-300" aria-hidden>
            ·
          </span>
          <span className="text-zinc-600">{homeDetail}</span>
        </>
      ) : null}
      {frequencyLabel ? (
        <>
          <span className="text-zinc-300" aria-hidden>
            ·
          </span>
          <span className="text-zinc-600">{frequencyLabel}</span>
        </>
      ) : null}
    </div>
  );
}
