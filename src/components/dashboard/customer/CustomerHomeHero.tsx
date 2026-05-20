import type { CustomerHomeHeroCopy } from "@/features/dashboards/customerHomeDisplay";

type Props = {
  copy: CustomerHomeHeroCopy;
};

/** Compact operational welcome line for the customer home hub. */
export function CustomerHomeHero({ copy }: Props) {
  return (
    <header className="max-w-2xl">
      <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">{copy.title}</h1>
      <p className="mt-1.5 text-sm leading-snug text-zinc-600 sm:text-[0.9375rem]">{copy.subtitle}</p>
    </header>
  );
}
