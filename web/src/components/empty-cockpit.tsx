/// The normal state.
///
/// At rest nothing is lit. An item on this screen always means an action,
/// so the empty version has to be genuinely empty — the moment something
/// appears here that needs nothing, the whole queue stops being read.
export function EmptyCockpit({ watching }: { watching: number }) {
  return (
    <div className="empty">
      <p>Nothing needs you.</p>
      <p className="sub">
        {watching === 0
          ? "No projects registered yet."
          : `Watching ${watching} project${watching === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}
