"use client";

import { ADMIN_DETAILS_DISCLOSURE_CLASS } from "@/features/dashboards/adminDisplay";
import { useSectionScrollSpy } from "@/lib/ui/useSectionScrollSpy";

export type AdminBookingDetailSectionId =
  | "overview"
  | "assignment"
  | "payments"
  | "timeline"
  | "records";

export const ADMIN_BOOKING_DETAIL_SECTION_IDS: readonly AdminBookingDetailSectionId[] = [
  "overview",
  "assignment",
  "payments",
  "timeline",
  "records",
];

const SECTIONS: readonly { id: AdminBookingDetailSectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "assignment", label: "Assignment" },
  { id: "payments", label: "Payments" },
  { id: "timeline", label: "Timeline" },
  { id: "records", label: "Records" },
];

const SECTION_ID_PREFIX = "admin-booking-";

type Props = {
  /** Override spy (tests); omit on the booking detail page for live scroll-spy. */
  activeSection?: AdminBookingDetailSectionId;
};

/** Lightweight anchor nav with IntersectionObserver scroll-spy (presentation only). */
export function AdminBookingDetailSectionNav({ activeSection: activeSectionOverride }: Props) {
  const spiedSection = useSectionScrollSpy({
    sectionIds: ADMIN_BOOKING_DETAIL_SECTION_IDS,
    idPrefix: SECTION_ID_PREFIX,
  });
  const activeSection = activeSectionOverride ?? spiedSection;

  return (
    <nav
      aria-label="Booking sections"
      className={`${ADMIN_DETAILS_DISCLOSURE_CLASS} sticky top-0 z-10 mb-2.5 flex flex-wrap gap-1.5 bg-white/95 p-2 backdrop-blur-sm sm:mb-3`}
    >
      {SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <a
            key={section.id}
            href={`#${SECTION_ID_PREFIX}${section.id}`}
            aria-current={isActive ? "true" : undefined}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-zinc-900 text-white shadow-sm"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
