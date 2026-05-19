import { DETAILS_SECTION_HEADING } from "../detailsStepUi";

type Props = {
  title: string;
  id?: string;
};

export function DetailsSectionHeading({ title, id }: Props) {
  return (
    <h3 id={id} className={DETAILS_SECTION_HEADING}>
      {title}
    </h3>
  );
}
