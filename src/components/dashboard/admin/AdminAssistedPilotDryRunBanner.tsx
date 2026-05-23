type Props = {
  pilotDryRun?: boolean;
};

export function AdminAssistedPilotDryRunBanner({ pilotDryRun = false }: Props) {
  if (!pilotDryRun) return null;

  return (
    <div
      className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"
      role="status"
      data-testid="admin-assisted-pilot-dry-run-banner"
    >
      <p className="font-semibold">This booking was created during the admin-assisted pilot.</p>
      <p className="mt-1 text-violet-900/90">
        Pilot / dry-run label only — payment, assignment, and lifecycle follow the normal production
        paths.
      </p>
    </div>
  );
}
