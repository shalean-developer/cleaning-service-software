import Image from "next/image";
import Link from "next/link";
import { CAPE_TOWN_AREAS, MARKETING_IMAGES } from "@/features/marketing/constants";
import { SectionHeading } from "../SectionHeading";

export function AreasSection() {
  return (
    <section id="areas" className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Local coverage"
          title="Areas We Serve in Cape Town"
          description="Professional cleaning across the Cape Peninsula, Northern Suburbs, and beyond."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="flex flex-wrap gap-2">
            {CAPE_TOWN_AREAS.map((area) => (
              <Link
                key={area}
                href="#contact"
                className="rounded-full border border-shalean-border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-shalean-primary hover:bg-shalean-soft-blue hover:text-shalean-primary"
              >
                {area}
              </Link>
            ))}
          </div>

          <div className="relative aspect-[16/11] overflow-hidden rounded-3xl shadow-xl">
            <Image
              src={MARKETING_IMAGES.capeTownAerial}
              alt="Aerial view of Cape Town and Table Mountain"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-shalean-navy/60 to-transparent" />
            <p className="absolute bottom-6 left-6 right-6 text-lg font-semibold text-white drop-shadow">
              Proudly serving Cape Town and surrounding areas
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
