import { useEffect, useMemo, useRef, useState } from "react";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckSquareIcon,
  SquareIcon,
} from "@phosphor-icons/react";
import type { FileDiff } from "@/core/review";
import { loadFile } from "@/core/review";
import { Badge, CodeBlock, CodeGap, Mono, RowButton, Text } from "@/components";
import { Row, Stack } from "@/frame";
import { gapAbove, gapRows, rows, tooBig } from "@/pages/review/logic";
import { Churn, lookOf, nameOf, StatusIcon } from "@/pages/review/status";
import { cn } from "@/lib/cn";
import { useText } from "@/lib/language";

/// One file's change, with its own header and its own fold.
///
/// Every changed file is on the page at once, so this is a section rather
/// than a screen: the header stays put while its hunks scroll under it, and
/// the fold is per file. A file already reviewed arrives folded — nothing is
/// hidden, the header still names it and counts it, but the scroll belongs
/// to what moved.
export function FileSection({
  project,
  file,
  unannounced,
  startOpen = true,
  onVouch,
  onEnter,
}: {
  project: string;
  file: FileDiff;
  unannounced: boolean;
  /// Whether this one arrives showing its diff. Decided by the page, which
  /// is the only thing that can see how much is already on it.
  startOpen?: boolean;
  /// Absent on a commit that has already landed. Nobody is asked to vouch
  /// for history, and a checkbox that records nothing is worse than none.
  onVouch?: (f: FileDiff) => void;
  /// Called when this file's header reaches the top of the page, so the
  /// tree beside it can say where you are.
  onEnter: (path: string) => void;
}) {
  const t = useText();
  const [open, setOpen] = useState(startOpen);
  const look = lookOf(file.status);
  const mine = useRef<HTMLDivElement>(null);

  // The file as it stands, fetched only if somebody asks to see past a hunk.
  // Every open diff would otherwise pull its whole file across the seam to
  // service a control most readers never touch.
  const [body, setBody] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());

  // The file moved: everything cached above describes content that is gone.
  //
  // Adjusted during render rather than in an effect. An effect would let one
  // paint through with the old file's expanded context under the new file's
  // hunks, and the reader would be looking at two versions at once without
  // being told.
  const [was, setWas] = useState(file.fingerprint);
  if (was !== file.fingerprint) {
    setWas(file.fingerprint);
    setBody(null);
    setUnreadable(null);
    setShown(new Set());
  }

  useEffect(() => {
    const el = mine.current;
    if (!el) return;
    // A band across the top of the pane. The file whose header last crossed
    // it is the one you are reading, which is the only definition that does
    // not flicker between two files at a boundary.
    const watch = new IntersectionObserver(
      (seen) => {
        for (const s of seen) if (s.isIntersecting) onEnter(file.path);
      },
      { rootMargin: "0px 0px -85% 0px" },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, [file.path, onEnter]);

  const expand = (i: number) => {
    setShown((s) => new Set(s).add(i));
    if (body !== null || reading) return;
    setReading(true);
    loadFile(project, file.path)
      .then(setBody)
      .catch((e) => setUnreadable(String(e)))
      .finally(() => setReading(false));
  };

  const viewed = !file.fresh;

  return (
    // A card with its own edge, and a gap to the next one. The boundary used
    // to be a hairline, and the header of a surprising file wore the same
    // wash as a removed line — so where one file ended and the next began
    // was a judgement call made in the middle of reading code.
    <Stack
      gap="none"
      className="scroll-mt-2 overflow-hidden rounded-card border border-line"
      ref={mine}
      id={anchor(file.path)}
    >
      <Row
        gap="snug"
        align="center"
        className="sticky top-0 z-10 border-line border-b bg-raised px-3 py-2"
      >
        <RowButton
          onClick={() => setOpen(!open)}
          className="w-auto shrink-0 gap-1.5 px-1"
          aria-expanded={open}
          aria-label={open ? t("Fold this file") : t("Unfold this file")}
        >
          {open ? <CaretDownIcon size={12} /> : <CaretRightIcon size={12} />}
        </RowButton>
        <StatusIcon status={file.status} />
        <Mono
          className={cn("min-w-0 truncate", look.struck && "line-through")}
          title={
            file.from ? t("Renamed from {old}", { old: file.from }) : nameOf(file.status, t)
          }
        >
          {file.path}
        </Mono>
        {unannounced ? (
          <Badge tone="alarm" title={t("No session's announcement names this file")}>
            {t("Unannounced")}
          </Badge>
        ) : null}
        <Row gap="none" className="ml-auto">
          <Churn file={file} />
        </Row>
        {/* A checkbox and not a button. "Viewed" is a state of the file you
            can take back, and a button reading "Mark reviewed" and then
            "Reviewed" gives no way to say you were wrong. Ticking it folds
            the file, because that is what ticking it meant. */}
        {onVouch ? (
          <RowButton
            onClick={() => {
              onVouch(file);
              setOpen(viewed);
            }}
            aria-pressed={viewed}
            className={cn("w-auto shrink-0 gap-1.5 px-1.5", viewed && "text-clay")}
          >
            {viewed ? <CheckSquareIcon size={14} weight="fill" /> : <SquareIcon size={14} />}
            <Text as="span" size="sm" className="text-inherit">
              {t("Viewed")}
            </Text>
          </RowButton>
        ) : null}
      </Row>

      {open ? (
        <Body
          file={file}
          body={body}
          reading={reading}
          unreadable={unreadable}
          shown={shown}
          onExpand={expand}
        />
      ) : null}
    </Stack>
  );
}

/// The id a file's section answers to, for scrolling to it from the tree.
///
/// Prefixed and encoded because a path contains slashes and dots, and an id
/// that is also a valid CSS selector fragment is one fewer thing that can
/// silently fail to be found.
export function anchor(path: string): string {
  return `f-${encodeURIComponent(path)}`;
}

function Body({
  file,
  body,
  reading,
  unreadable,
  shown,
  onExpand,
}: {
  file: FileDiff;
  body: string | null;
  reading: boolean;
  unreadable: string | null;
  shown: Set<number>;
  onExpand: (i: number) => void;
}) {
  const t = useText();
  const [anyway, setAnyway] = useState(false);

  // Aligning every pair of lines in a diff is quadratic per pair. Cheap for
  // one file and not cheap on every keystroke in the search box next door.
  const painted = useMemo(() => file.hunks.map(rows), [file]);

  if (file.hunks.length === 0) {
    return (
      <Text tone="muted" size="sm" className="px-4 py-4">
        {t("Nothing in the text of this file changed.")}
      </Text>
    );
  }

  if (tooBig(file) && !anyway) {
    return (
      <Stack gap="snug" align="start" className="px-4 py-5">
        <Text tone="muted" size="sm">
          {t.plural(
            file.added + file.removed,
            "{n} changed line, held back so it does not bury the rest.",
            "{n} changed lines, held back so they do not bury the rest.",
          )}
        </Text>
        <RowButton
          onClick={() => setAnyway(true)}
          className="w-auto rounded-lg border border-line px-2.5 py-1 text-xs"
        >
          {t("Show it anyway")}
        </RowButton>
      </Stack>
    );
  }

  return (
    <Stack gap="none">
      {file.hunks.map((h, i) => {
        const gap = gapAbove(file.hunks, i);
        return (
          <Stack key={h.header + String(i)} gap="none">
            {gap ? (
              shown.has(i) && body !== null ? (
                <CodeBlock lines={gapRows(body, gap, h)} />
              ) : (
                <CodeGap
                  busy={reading}
                  onExpand={() => onExpand(i)}
                  label={t.plural(
                    gap.to - gap.from + 1,
                    "{n} unchanged line",
                    "{n} unchanged lines",
                  )}
                />
              )
            ) : null}
            <CodeBlock header={h.header} lines={painted[i]} />
          </Stack>
        );
      })}
      {unreadable ? (
        <Text tone="alarm" size="sm" className="px-4 py-2">
          {t("Could not read the file to expand it: {why}", { why: unreadable })}
        </Text>
      ) : null}
    </Stack>
  );
}
