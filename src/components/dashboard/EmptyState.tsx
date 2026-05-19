import {
  UI_EMPTY_STATE_ACTIONS_CLASS,
  UI_EMPTY_STATE_DESCRIPTION_CLASS,
  UI_EMPTY_STATE_SHELL_CLASS,
  UI_EMPTY_STATE_TITLE_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <section className={UI_EMPTY_STATE_SHELL_CLASS}>
      <h2 className={UI_EMPTY_STATE_TITLE_CLASS}>{title}</h2>
      {description ? <p className={UI_EMPTY_STATE_DESCRIPTION_CLASS}>{description}</p> : null}
      {action ? <section className={UI_EMPTY_STATE_ACTIONS_CLASS}>{action}</section> : null}
    </section>
  );
}
