type Props = {
  title: string;
  subtitle?: string;
};

export function WizardStepHeading({ title, subtitle }: Props) {
  return (
    <header className="mb-3 md:mb-4">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">{subtitle}</p>
      ) : null}
    </header>
  );
}
