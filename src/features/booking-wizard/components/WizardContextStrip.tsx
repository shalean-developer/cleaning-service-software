import type { PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import { isOfficeCleaningSlug } from "../officeCleaningDisplay";
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
  if (!serviceSlug || isOfficeCleaningSlug(serviceSlug)) {
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

  const segments = [serviceLabel, homeDetail, frequencyLabel].filter(Boolean) as string[];

  return (
    <div
      className="mb-3 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-zinc-200/90 bg-zinc-50/80 px-3.5 py-2 text-center text-sm leading-snug md:mb-4 sm:justify-start sm:text-left"
      aria-label="Booking context"
    >
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
          ) : null}
          <span
            className={
              index === 0 ? "font-medium text-sky-800" : "font-normal text-zinc-600"
            }
          >
            {segment}
          </span>
        </span>
      ))}
    </div>
  );
}
