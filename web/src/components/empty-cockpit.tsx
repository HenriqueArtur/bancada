/// The normal state.
///
/// At rest nothing is lit. An item on this screen always means an action,
/// so the empty version has to be genuinely empty — the moment something
/// appears here that needs nothing, the whole queue stops being read.
export function EmptyCockpit({
  watching,
  onRegister,
}: {
  watching: number;
  onRegister?: () => void;
}) {
  return (
    <div className="empty">
      <p>Nothing needs you.</p>
      <p className="sub">
        {watching === 0
          ? "No projects registered yet."
          : `Watching ${watching} project${watching === 1 ? "" : "s"}.`}
      </p>
      {/* Only when there is nothing to watch. An empty cockpit that *is*
          watching is the product working, and a call to action there would
          make the good state look like a problem. */}
      {watching === 0 && onRegister ? (
        <button type="button" className="back" onClick={onRegister}>
          register one →
        </button>
      ) : null}
    </div>
  );
}
