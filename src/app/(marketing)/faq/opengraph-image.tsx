import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Cleaning service FAQs — Shalean Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function FaqOgImage() {
  return renderShaleanOgImage({
    title: "Cleaning Service FAQs",
    subtitle: "Pricing, bookings, supplies & Cape Town areas",
  });
}
