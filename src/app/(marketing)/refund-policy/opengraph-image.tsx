import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";

export const alt = "Shalean Refund Policy";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function RefundPolicyOgImage() {
  return renderShaleanOgImage({
    title: "Refund Policy",
    subtitle: "Fair cancellations and satisfaction support",
  });
}
