/// Says out loud that this is not your cockpit.
///
/// A window reading a scratch configuration is indistinguishable from the
/// real one, and every screen here is a claim about what needs *you*. A
/// claim about somewhere else has to announce itself, or it is worse than
/// no claim at all.
///
/// Absent for the default configuration, so it costs nothing to the case
/// that matters: a warning that is always on is a warning nobody reads.
export function ElsewhereBand({ path }: { path: string | null }) {
  if (!path) return null;
  return (
    <div className="elsewhere" role="status">
      <strong>not your cockpit</strong>
      <span className="mono">{path}</span>
    </div>
  );
}
