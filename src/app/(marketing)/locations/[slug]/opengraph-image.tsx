import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  renderShaleanOgImage,
} from "@/features/marketing/og-image";
import { LOCATION_SEO_SLUGS } from "@/features/marketing/marketing-routes";
import {
  LOCATION_SEO_CONTENT,
  isLocationSeoSlug,
} from "@/features/marketing/seo-pages";

export const alt = "Shalean cleaning services in Cape Town";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

type OgProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return LOCATION_SEO_SLUGS.map((slug) => ({ slug }));
}

export default async function LocationOgImage({ params }: OgProps) {
  const { slug } = await params;
  if (!isLocationSeoSlug(slug)) {
    return renderShaleanOgImage({ title: "Cleaning Services Cape Town" });
  }
  const content = LOCATION_SEO_CONTENT[slug];
  return renderShaleanOgImage({
    eyebrow: "Cape Town",
    title: content.h1,
    subtitle: "Home, deep & Airbnb cleaning",
  });
}
