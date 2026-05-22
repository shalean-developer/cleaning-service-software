import {
  UI_EMPTY_STATE_DESCRIPTION_CLASS,
  UI_EMPTY_STATE_TITLE_CLASS,
  UI_FETCH_ERROR_SHELL_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  title: string;
  description?: string;
};

/** Distinct from {@link EmptyState}. used when data failed to load, not when the list is empty. */
export function DashboardFetchError({ title, description }: Props) {
  return (
    <section role="alert" className={UI_FETCH_ERROR_SHELL_CLASS}>
      <h2 className={UI_EMPTY_STATE_TITLE_CLASS}>{title}</h2>
      {description ? <p className={UI_EMPTY_STATE_DESCRIPTION_CLASS}>{description}</p> : null}
    </section>
  );
}
