import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug } from "@/features/pricing/server/types";
import { ADDON_STEP_DESCRIPTIONS, ADDON_STEP_DISPLAY_ORDER } from "../constants";
import { formatAddonPrice } from "../format";

type Props = {
  selected: AddonSlug[];
  onChange: (addons: AddonSlug[]) => void;
};

type AddonRowProps = {
  slug: AddonSlug;
  checked: boolean;
  onToggle: (slug: AddonSlug, enabled: boolean) => void;
};

function AddonToggle({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} add-on`}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 motion-reduce:transition-none ${
        checked ? "bg-zinc-900" : "bg-zinc-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function AddonRow({ slug, checked, onToggle }: AddonRowProps) {
  const addon = ADDON_CATALOG[slug];

  return (
    <li className="flex items-center gap-3 border-b border-zinc-100 px-4 py-4 last:border-b-0 sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-zinc-900">{addon.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
          {ADDON_STEP_DESCRIPTIONS[slug]}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-500">
        {formatAddonPrice(addon.amountCents)}
      </span>
      <AddonToggle
        checked={checked}
        label={addon.label}
        onToggle={() => onToggle(slug, !checked)}
      />
    </li>
  );
}

export function AddonsStepPanel({ selected, onChange }: Props) {
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
    <div className="mb-4 min-w-0">
      <span
        id="addons-step-label"
        className="mb-2 block text-sm font-medium text-zinc-800"
      >
        Add-ons
      </span>

      <div
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
        role="group"
        aria-labelledby="addons-step-label"
      >
        <ul className="m-0 list-none p-0">
          {ADDON_STEP_DISPLAY_ORDER.map((slug) => (
            <AddonRow
              key={slug}
              slug={slug}
              checked={selected.includes(slug)}
              onToggle={toggleAddon}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
