"use client";

import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug } from "@/features/pricing/server/types";
import { getAddonsSectionHint, getAddonsSectionTitle } from "../airbnbCleaningDisplay";
import { CARPET_FORM_ADDON_ROWS } from "../carpetCleaningDisplay";
import { DETAILS_OPTION_DESC, DETAILS_STEP_SECTION } from "../detailsStepUi";
import { formatAddonPrice } from "../format";
import { DetailsSectionHeading } from "./DetailsSectionHeading";
import { DetailsToggleSwitch } from "./DetailsToggleSwitch";

type Props = {
  selected: AddonSlug[];
  onChange: (addons: AddonSlug[]) => void;
};

function SoonAddonRow({ label }: { label: string }) {
  return (
    <li
      aria-disabled="true"
      className="flex min-w-0 cursor-not-allowed items-center gap-2 border-b border-zinc-100 px-2.5 py-2 opacity-60 last:border-b-0 sm:gap-2.5 sm:px-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-zinc-500">{label}</p>
        <p className={`${DETAILS_OPTION_DESC} line-clamp-2`}>Coming soon</p>
      </div>
      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Soon
      </span>
    </li>
  );
}

function PricedAddonRow({
  slug,
  label,
  description,
  checked,
  onToggle,
}: {
  slug: AddonSlug;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const addon = ADDON_CATALOG[slug];
  const rowClass = checked ? "bg-zinc-50/80" : "bg-white";

  return (
    <li
      className={`flex min-w-0 items-center gap-2 border-b border-zinc-100 px-2.5 py-2 last:border-b-0 sm:gap-2.5 sm:px-3 ${rowClass}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-zinc-900">{label}</p>
        <p className={`${DETAILS_OPTION_DESC} line-clamp-2`}>{description}</p>
      </div>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-500 sm:text-xs">
        {formatAddonPrice(addon.amountCents)}
      </span>
      <DetailsToggleSwitch
        checked={checked}
        label={`${label} add-on`}
        onToggle={() => onToggle(!checked)}
      />
    </li>
  );
}

export function CarpetAddonsStepPanel({ selected, onChange }: Props) {
  const toggleAddon = (slug: AddonSlug, enabled: boolean) => {
    if (enabled) {
      if (!selected.includes(slug)) {
        onChange([...selected, slug]);
      }
      return;
    }
    onChange(selected.filter((a) => a !== slug));
  };

  return (
    <section className={DETAILS_STEP_SECTION} aria-labelledby="carpet-addons-step-label">
      <DetailsSectionHeading
        title={getAddonsSectionTitle("carpet-cleaning")}
        id="carpet-addons-step-label"
      />
      {getAddonsSectionHint("carpet-cleaning") ? (
        <p className="mb-2 text-xs leading-snug text-zinc-500">
          {getAddonsSectionHint("carpet-cleaning")}
        </p>
      ) : null}

      <div
        className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm"
        role="group"
        aria-labelledby="carpet-addons-step-label"
      >
        <ul className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2">
          {CARPET_FORM_ADDON_ROWS.map((row) => {
            if (row.kind === "soon") {
              return <SoonAddonRow key={row.id} label={row.label} />;
            }
            return (
              <PricedAddonRow
                key={row.addonSlug}
                slug={row.addonSlug}
                label={row.label}
                description={row.description}
                checked={selected.includes(row.addonSlug)}
                onToggle={(enabled) => toggleAddon(row.addonSlug, enabled)}
              />
            );
          })}
        </ul>
      </div>
    </section>
  );
}
