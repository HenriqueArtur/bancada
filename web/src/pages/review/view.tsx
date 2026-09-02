import { useCallback, useEffect, useState } from "react";
import type { FileDiff } from "@/core/review";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { Inset, Row, Scroller, Stack } from "@/frame";
import { Panes } from "@/layouts";
import { InsideProject, type Inside } from "@/pages/_shared";
import { ChangedFiles } from "@/pages/review/changed";
import { anchor, FileSection } from "@/pages/review/diff";
import {
  type Filters,
  firstToRead,
  NOTHING_FILTERED,
  openOnArrival,
  sift,
  totals,
  useReview,
} from "@/pages/review/logic";
import { useText } from "@/lib/language";

/// Everything the tree has that its last commit does not.
///
/// One page with every changed file on it, and a tree beside it that scrolls
/// you to one. The tree selects nothing — which is why there is no way back
/// out of it, and why the screen the reviewer lands on is the whole change
/// rather than one file somebody's code chose for them.
export function ChangesPage(inside: Inside) {
  const { project } = inside;
  const t = useText();
  const { data, failed, vouch } = useReview(project);
  const [filters, setFilters] = useState<Filters>(NOTHING_FILTERED);
  const [at, setAt] = useState<string | null>(null);

  const goTo = useCallback((path: string) => {
    // `getElementById` rather than a ref per file: the sections are built by
    // a map over the diff and the set changes with the filters, so a table
    // of refs would be a second copy of the list to keep in step.
    document.getElementById(anchor(path))?.scrollIntoView({ block: "start" });
  }, []);

  // Jump to the first file nobody announced, and only that. Arriving
  // already scrolled is the page deciding you were somewhere else, and it
  // has to earn that — "you have not read this yet" is true of most of the
  // list and is not a reason to move anybody. A deviation is.
  //
  // Once, too. Vouching for a file reloads the review, and jumping again
  // would throw the reader back up the page they were working down.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (landed || !data) return;
    setLanded(true);
    const first = firstToRead(data.diff.files, data.unannounced);
    if (first && data.unannounced.includes(first)) requestAnimationFrame(() => goTo(first));
  }, [data, landed, goTo]);

  const shell = (index: React.ReactNode, subject: React.ReactNode) => (
    <InsideProject {...inside}>
      <Panes index={index} subject={subject} />
    </InsideProject>
  );

  if (failed) {
    return shell(
      null,
      <Inset>
        <Banner label={t("Could not read")} tone="alarm">
          <Text as="span" size="sm" tone="alarm">
            {failed}
          </Text>
        </Banner>
      </Inset>,
    );
  }
  if (!data) {
    return shell(
      null,
      <Inset>
        <Text tone="muted" size="sm">
          {t("Reading the tree…")}
        </Text>
      </Inset>,
    );
  }
  if (data.unreachable) {
    return shell(
      null,
      <Inset>
        <Banner label={t("Could not read the tree")} tone="alarm">
          <Text as="span" size="sm" tone="alarm">
            {data.unreachable}
          </Text>
        </Banner>
      </Inset>,
    );
  }

  const showing = sift(data.diff.files, data.unannounced, filters);
  const unfolded = openOnArrival(showing);

  return shell(
    <ChangedFiles
      files={data.diff.files}
      unannounced={data.unannounced}
      filters={filters}
      onFilters={setFilters}
      at={at}
      onGoTo={goTo}
    />,
    // The height has to come down the tree unbroken or nothing scrolls:
    // this column is what stops growing, and the `Scroller` under it is what
    // scrolls. Left to grow, `Bleed` clips the overflow and it becomes a
    // pane you cannot reach — with `scrollIntoView` scrolling the whole
    // window instead and carrying the header off screen.
    <Stack gap="none" className="min-h-0 flex-1">
      <Summary all={data.diff.files} showing={showing} unannounced={data.unannounced} />
      <Scroller className="min-h-0 flex-1">
        {showing.length === 0 ? (
          <Text tone="muted" size="sm" className="p-6">
            {data.diff.files.length === 0
              ? t("The tree matches its last commit.")
              : t("Every file is filtered out.")}
          </Text>
        ) : (
          <Stack gap="snug" className="p-3">
            {showing.map((f) => (
              <FileSection
                key={f.path}
                project={project}
                file={f}
                unannounced={data.unannounced.includes(f.path)}
                startOpen={unfolded.has(f.path)}
                onVouch={vouch}
                onEnter={setAt}
              />
            ))}
          </Stack>
        )}
      </Scroller>
    </Stack>,
  );
}

/// How much there is to read, in one line.
///
/// The counts are of what is *showing*, and it says so when that is not
/// everything. A header that keeps reporting seventeen files while the
/// filter has left you three is a header you learn to ignore.
function Summary({
  all,
  showing,
  unannounced,
}: {
  all: FileDiff[];
  showing: FileDiff[];
  unannounced: string[];
}) {
  const t = useText();
  const sum = totals(showing, unannounced);
  const hidden = all.length - showing.length;

  return (
    <Row
      gap="snug"
      align="baseline"
      className="shrink-0 border-line border-b bg-ground px-4 py-2.5"
    >
      <Text as="span" size="sm">
        {t.plural(sum.files, "{n} changed file", "{n} changed files")}
      </Text>
      <Text as="span" size="sm" className="text-sage tabular-nums">
        +{sum.added}
      </Text>
      <Text as="span" size="sm" className="text-alarm tabular-nums">
        −{sum.removed}
      </Text>
      {sum.unannounced > 0 ? (
        <Text as="span" size="sm" tone="alarm">
          ▲ {t.plural(sum.unannounced, "{n} unannounced", "{n} unannounced")}
        </Text>
      ) : null}
      {hidden > 0 ? (
        <Text as="span" size="sm" tone="faint" className="ml-auto">
          {t.plural(hidden, "{n} filtered out", "{n} filtered out")}
        </Text>
      ) : null}
    </Row>
  );
}
