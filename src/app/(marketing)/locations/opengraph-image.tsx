import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Shalean cleaning service areas across Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function LocationsHubOgImage() {
  return renderShaleanOgImage({
    title: "Cleaning Across Cape Town",
    subtitle: "Sea Point, Claremont, Camps Bay & more",
  });
}
