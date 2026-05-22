import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Shalean Cleaning Services. professional cleaning in Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function MarketingHomeOgImage() {
  return renderShaleanOgImage({
    eyebrow: "Cape Town cleaning services",
    title: "Cleaning Services Cape Town",
    subtitle: "Vetted cleaners · transparent prices · book online",
  });
}
