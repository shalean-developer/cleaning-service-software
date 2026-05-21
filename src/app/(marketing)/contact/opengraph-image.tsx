import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Contact Shalean Cleaning Services Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function ContactOgImage() {
  return renderShaleanOgImage({
    title: "Contact Shalean",
    subtitle: "Phone, email & WhatsApp · Cape Town",
  });
}
