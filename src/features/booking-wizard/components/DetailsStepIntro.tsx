import type { ServiceSlug } from "@/features/pricing/server/types";
import { getDetailsStepIntro } from "../airbnbCleaningDisplay";
import { DETAILS_STEP_INTRO, DETAILS_STEP_TITLE } from "../detailsStepUi";

type Props = {
  serviceSlug: ServiceSlug | null;
};

export function DetailsStepIntro({ serviceSlug }: Props) {
  const { title, description } = getDetailsStepIntro(serviceSlug);

  return (
    <header className="mb-4 min-w-0">
      <h2 className={DETAILS_STEP_TITLE}>{title}</h2>
      <p className={DETAILS_STEP_INTRO}>{description}</p>
    </header>
  );
}
