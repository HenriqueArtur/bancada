import type { SessionReview } from "@/core/review";
import { Mono, Quote, Text } from "@/components";
import { Stack } from "@/frame";
import { useText } from "@/lib/language";

/// What each session said it would do, in its own words.
///
/// Quoted rather than summarised: a summary of a claim is a second claim,
/// and the whole point of the panel is to hand the reviewer the original to
/// hold the diff against.
export function IntentPanel({ sessions }: { sessions: SessionReview[] }) {
  const t = useText();
  if (sessions.length === 0) {
    return (
      <Text tone="muted" size="sm">
        {t("No session in this project has written anything.")}
      </Text>
    );
  }
  return (
    <Stack gap="normal">
      {sessions.map((s) => (
        <Stack key={s.session} gap="tight" className="border-l-2 border-line pl-4">
          <Mono tone="faint">{s.session.slice(0, 8)}</Mono>
          {s.intent ? (
            <Quote>{s.intent}</Quote>
          ) : (
            <Text tone="alarm" size="sm">
              {t.plural(
                s.touched.length,
                "Changed {n} file without saying it would.",
                "Changed {n} files without saying it would.",
              )}
            </Text>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
