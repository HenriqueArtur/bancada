import {
  FileIcon,
  FileMinusIcon,
  FilePlusIcon,
  FilesIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { FileDiff, Status } from "@/core/review";
import type { Translate } from "@/core/language";
import { Row } from "@/frame";
import { Text } from "@/components";
import { useText } from "@/lib/language";

/// What each status looks like, in one place.
///
/// Shape carries it and colour agrees. A reviewer who does not separate sage
/// from clay still has to be able to read this list, and at 248px four
/// silhouettes tell each other apart faster than four letters at 11px do —
/// the outline lands before the glyph is read.
///
/// Deleted also strikes the name through. It is the one status where colour
/// alone would be doing real work: everything else still exists.
const LOOK: Record<Status, { icon: Icon; tone: string; struck: boolean }> = {
  added: { icon: FilePlusIcon, tone: "text-sage", struck: false },
  modified: { icon: FileIcon, tone: "text-clay", struck: false },
  deleted: { icon: FileMinusIcon, tone: "text-alarm", struck: true },
  // Two files, one behind the other: it was there, and now it is here.
  // Phosphor has no file-with-an-arrow, and at 13px a dashed outline — the
  // other candidate — is indistinguishable from a solid one.
  renamed: { icon: FilesIcon, tone: "text-ink-muted", struck: false },
};

export function lookOf(status: Status) {
  return LOOK[status];
}

/// The word for a status, for a tooltip and for a screen reader.
///
/// A function of `t` rather than a constant, because a phrase has to reach
/// `t("…")` as a literal to be extractable — see `text:check`.
export function nameOf(status: Status, t: Translate): string {
  switch (status) {
    case "added":
      return t("Added");
    case "deleted":
      return t("Deleted");
    case "renamed":
      return t("Renamed");
    default:
      return t("Modified");
  }
}

export function StatusIcon({ status, size = 13 }: { status: Status; size?: number }) {
  const { icon: Glyph, tone } = LOOK[status];
  return <Glyph size={size} weight="bold" className={`shrink-0 ${tone}`} />;
}

/// How much of a file moved, in the two colours it moved in.
///
/// A side that did not move is left out rather than printed as zero. `+0
/// −39` on a deleted file makes the reader check a number that cannot be
/// anything else, and the tree and the diff header have to agree about it —
/// which is why this is one component and not two spellings.
export function Churn({ file }: { file: Pick<FileDiff, "added" | "removed"> }) {
  const t = useText();
  return (
    <Row gap="tight" className="shrink-0 tabular-nums">
      {file.added > 0 ? (
        <Text as="span" size="sm" className="text-sage">
          +{file.added}
        </Text>
      ) : null}
      {file.removed > 0 ? (
        <Text as="span" size="sm" className="text-alarm">
          −{file.removed}
        </Text>
      ) : null}
      {file.added === 0 && file.removed === 0 ? (
        <Text as="span" size="sm" tone="faint">
          {t("no lines")}
        </Text>
      ) : null}
    </Row>
  );
}
