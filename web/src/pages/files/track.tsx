import type { Track } from "@/core/review";
import type { Translate } from "@/core/language";
import { Text } from "@/components";

/// How a tracked path reads in a tree: a colour and a letter.
///
/// The editor's convention rather than one of our own. Anybody who has used
/// VS Code already knows that a green `U` is untracked and an amber `M` is
/// modified, and inventing a second vocabulary for the same six states buys
/// nothing but the cost of learning it.
///
/// The letter is not decoration. A reviewer who does not separate sage from
/// clay still has to be able to read this column, and colour alone would
/// leave them with a tree of identically-shaped rows.
const LOOK: Record<Track, { letter: string; tone: string }> = {
  modified: { letter: "M", tone: "text-clay" },
  added: { letter: "A", tone: "text-sage" },
  untracked: { letter: "U", tone: "text-sage" },
  deleted: { letter: "D", tone: "text-alarm" },
  renamed: { letter: "R", tone: "text-ink-muted" },
  conflicted: { letter: "C", tone: "text-alarm" },
  ignored: { letter: "", tone: "text-ink-faint" },
};

export function toneOf(track: Track | null): string {
  return track ? LOOK[track].tone : "";
}

export function nameOfTrack(track: Track, t: Translate): string {
  switch (track) {
    case "added":
      return t("Added");
    case "untracked":
      return t("Untracked");
    case "deleted":
      return t("Deleted");
    case "renamed":
      return t("Renamed");
    case "conflicted":
      return t("Conflicted");
    case "ignored":
      return t("Ignored");
    default:
      return t("Modified");
  }
}

/// The letter beside a row. Nothing at all for an ignored path — it is
/// already grey, and a badge saying so would give the row it dims the loudest
/// mark in the column.
export function TrackMark({ track, title }: { track: Track; title: string }) {
  const { letter, tone } = LOOK[track];
  if (letter === "") return null;
  return (
    <Text
      as="span"
      size="sm"
      title={title}
      className={`ml-auto shrink-0 font-medium tabular-nums ${tone}`}
    >
      {letter}
    </Text>
  );
}
