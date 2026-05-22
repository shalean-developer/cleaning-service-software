import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Shalean professional cleaning services in Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function ServicesHubOgImage() {
  return renderShaleanOgImage({
    title: "Cleaning Services Cape Town",
    subtitle: "Homes, hosts, offices & specialized cleaning",
  });
}
