import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import type { Landed } from "@/core/git";
import { loadCommit } from "@/core/git";
import { prose } from "@/core/prose";
import { Button, Mono, Prose, Text } from "@/components";
import { Banner } from "@/composites";
import { Inset, Row, Scroller, Stack } from "@/frame";
import { FileSection } from "@/pages/review/diff";
import { openOnArrival, totals } from "@/pages/review/logic";
import { Since } from "@/pages/git/since";
import { useText } from "@/lib/language";

/// One commit, read the same way as uncommitted work.
///
/// The same `FileSection`, which is the point: a diff is a diff, and a
/// reviewer who learned to read one screen should not have to learn a second
/// one because this change happens to have a hash.
///
/// What it does not have is the review apparatus. "Viewed" and "unannounced"
/// are both about work that has not landed yet — nobody is being asked to
/// vouch for history, and there is no session claim to hold it against.
export function LandedView({
  project,
  sha,
  onBack,
}: {
  project: string;
  sha: string;
  onBack: () => void;
}) {
  const t = useText();
  const [landed, setLanded] = useState<Landed | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLanded(null);
    setFailed(null);
    loadCommit(project, sha)
      .then((got) => alive && setLanded(got))
      .catch((e) => alive && setFailed(String(e)));
    return () => {
      alive = false;
    };
  }, [project, sha]);

  const back = (
    <Button tone="ghost" size="sm" onClick={onBack} className="-ml-2.5 shrink-0">
      <ArrowLeftIcon size={13} />
      {t("History")}
    </Button>
  );

  if (failed) {
    return (
      <Stack gap="none" className="min-h-0 flex-1">
        <Row gap="snug" className="shrink-0 border-line border-b bg-ground px-4 py-2">
          {back}
        </Row>
        <Inset>
          <Banner label={t("Could not read the commit")} tone="alarm">
            <Text as="span" size="sm" tone="alarm">
              {failed}
            </Text>
          </Banner>
        </Inset>
      </Stack>
    );
  }

  if (!landed) {
    return (
      <Stack gap="none" className="min-h-0 flex-1">
        <Row gap="snug" className="shrink-0 border-line border-b bg-ground px-4 py-2">
          {back}
        </Row>
        <Inset>
          <Text tone="muted" size="sm">
            {t("Reading the commit…")}
          </Text>
        </Inset>
      </Stack>
    );
  }

  const files = landed.diff.files;
  const sum = totals(files, []);
  const unfolded = openOnArrival(files.map((f) => ({ ...f, fresh: true })));

  return (
    <Stack gap="none" className="min-h-0 flex-1">
      <Stack gap="tight" className="shrink-0 border-line border-b bg-ground px-4 py-2.5">
        <Row gap="snug" align="baseline" className="min-w-0">
          {back}
          <Text as="span" className="min-w-0 truncate font-medium">
            {landed.commit.subject || t("(no message)")}
          </Text>
        </Row>
        <Row gap="snug" align="baseline" wrap>
          <Mono tone="faint">{landed.commit.short}</Mono>
          <Text as="span" size="sm" tone="faint">
            {landed.commit.author}
          </Text>
          <Since when={landed.commit.when} now={Date.now()} />
          <Text as="span" size="sm" tone="muted">
            {t.plural(sum.files, "{n} changed file", "{n} changed files")}
          </Text>
          <Text as="span" size="sm" className="text-sage tabular-nums">
            +{sum.added}
          </Text>
          <Text as="span" size="sm" className="text-alarm tabular-nums">
            −{sum.removed}
          </Text>
        </Row>
      </Stack>

      <Scroller className="min-h-0 flex-1">
        {/* The whole message, not the subject alone. This repository writes
            long ones on purpose: the diff already says what changed, and the
            body is the only place what was considered and dropped is
            written down. Set as prose, because that is what it is. */}
        {landed.body ? (
          <Inset pad="loose">
            <Prose blocks={prose(landed.body)} className="max-w-[68ch]" />
          </Inset>
        ) : null}
        {files.length === 0 ? (
          <Inset>
            <Text tone="muted" size="sm">
              {t("This commit changed no files.")}
            </Text>
          </Inset>
        ) : (
          <Stack gap="snug" className="p-3">
            {files.map((f) => (
              <FileSection
                key={f.path}
                project={project}
                file={f}
                unannounced={false}
                startOpen={unfolded.has(f.path)}
                onEnter={() => {}}
              />
            ))}
          </Stack>
        )}
      </Scroller>
    </Stack>
  );
}
