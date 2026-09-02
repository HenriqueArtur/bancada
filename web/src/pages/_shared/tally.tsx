import type { Summary } from "@/core/review";
import { Text } from "@/components";
import { Row } from "@/frame";
import { useText } from "@/lib/language";

/// How much has moved in this project, along the bottom of every screen.
///
/// The same three numbers on all four, so "how big is this" is a glance and
/// not a tab change. Read from its own call rather than from the diff: the
/// tree screen has no reason to pay for thirty thousand lines of hunks to
/// print a file count.
export function Tally({ summary }: { summary: Summary | null }) {
  const t = useText();

  return (
    <Row
      gap="snug"
      align="baseline"
      className="shrink-0 border-line border-t bg-surface px-4 py-1.5"
    >
      {summary === null ? (
        <Text as="span" size="sm" tone="faint">
          {t("Counting what changed…")}
        </Text>
      ) : !summary.versioned ? (
        // Not "nothing uncommitted". That is a claim about a repository, and
        // this project is pointed at a plain directory.
        <Text as="span" size="sm" tone="faint">
          {t("Not a git repository.")}
        </Text>
      ) : summary.files === 0 ? (
        <Text as="span" size="sm" tone="faint">
          {t("Nothing uncommitted.")}
        </Text>
      ) : (
        <>
          <Text as="span" size="sm" tone="muted">
            {t.plural(summary.files, "{n} changed file", "{n} changed files")}
          </Text>
          {/* Tabular figures. A footer whose numbers shift sideways every
              time a line lands reads as movement rather than as a count. */}
          <Text as="span" size="sm" className="text-sage tabular-nums">
            +{summary.added}
          </Text>
          <Text as="span" size="sm" className="text-alarm tabular-nums">
            −{summary.removed}
          </Text>
        </>
      )}
    </Row>
  );
}
