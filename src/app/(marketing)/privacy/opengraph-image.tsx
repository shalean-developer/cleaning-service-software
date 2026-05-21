import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Shalean Privacy Policy";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function PrivacyOgImage() {
  return renderShaleanOgImage({
    title: "Privacy Policy",
    subtitle: "How Shalean protects your information",
  });
}
