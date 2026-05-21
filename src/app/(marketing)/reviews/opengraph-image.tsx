import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Shalean customer reviews Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function ReviewsOgImage() {
  return renderShaleanOgImage({
    eyebrow: "Trusted in Cape Town",
    title: "Customer Reviews",
    subtitle: "Real feedback from Shalean clients",
  });
}
