import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Shalean Terms and Conditions";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function TermsOgImage() {
  return renderShaleanOgImage({
    title: "Terms and Conditions",
    subtitle: "Shalean Cleaning Services · Cape Town",
  });
}
