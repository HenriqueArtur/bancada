import type { SessionReview } from "../review";

/// What each session said it would do, in its own words.
///
/// Quoted rather than summarised: a summary of a claim is a second claim,
/// and the whole point of the panel is to hand the reviewer the original to
/// hold the diff against.
export function IntentPanel({ sessions }: { sessions: SessionReview[] }) {
  if (sessions.length === 0) {
    return <p className="quiet">no session in this project has written anything</p>;
  }
  return (
    <div className="intents">
      {sessions.map((s) => (
        <article key={s.session} className="intent">
          <h3>{s.session.slice(0, 8)}</h3>
          {s.intent ? (
            <blockquote>{s.intent}</blockquote>
          ) : (
            <p className="quiet surprise">
              changed {s.touched.length} file(s) without saying it would
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
