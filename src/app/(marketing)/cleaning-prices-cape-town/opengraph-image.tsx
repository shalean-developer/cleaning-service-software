import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Cleaning prices in Cape Town. Shalean";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function PricingOgImage() {
  return renderShaleanOgImage({
    eyebrow: "Transparent pricing",
    title: "Cleaning Prices Cape Town",
    subtitle: "Instant quotes · no hidden costs · book online",
  });
}
