import { DETAILS_STEP_INTRO, DETAILS_STEP_TITLE } from "../detailsStepUi";

export function DetailsStepIntro() {
  return (
    <header className="mb-4 min-w-0">
      <h2 className={DETAILS_STEP_TITLE}>Your home &amp; options</h2>
      <p className={DETAILS_STEP_INTRO}>Tell us what affects time, supplies, and support.</p>
    </header>
  );
}
