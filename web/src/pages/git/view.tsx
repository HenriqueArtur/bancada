import { useState } from "react";
import { GitBranchIcon } from "@phosphor-icons/react";
import type { Commit } from "@/core/git";
import { Badge, Button, Mono, RowButton, Text } from "@/components";
import { Banner } from "@/composites";
import { Inset, Listing, ListingItem, Region, Row, Scroller, Stack } from "@/frame";
import { Panes } from "@/layouts";
import { InsideProject, type Inside } from "@/pages/_shared";
import { byDay, useHistory } from "@/pages/git/logic";
import { LandedView } from "@/pages/git/landed";
import { Since } from "@/pages/git/since";
import { useText } from "@/lib/language";

/// What has already landed, and which branch you are on.
///
/// Read only. The product reads a repository somebody else is working in,
/// and a supervisor that moves the branch or discards a change under a
/// running agent is worse than one that shows less. Staging and committing
/// are a decision still to be made, and one that needs its own ADR.
export function GitPage(inside: Inside) {
  const t = useText();
  const { commits, branches, failed, more, loading, further } = useHistory(inside.project);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <InsideProject {...inside}>
      <Panes
        index={<Branches />}
        subject={
          failed ? (
            <Inset>
              <Banner label={t("Could not read the history")} tone="alarm">
                <Text as="span" size="sm" tone="alarm">
                  {failed}
                </Text>
              </Banner>
            </Inset>
          ) : open ? (
            <LandedView project={inside.project} sha={open} onBack={() => setOpen(null)} />
          ) : (
            <Scroller className="min-h-0 flex-1">
              <History
                commits={commits}
                more={more}
                loading={loading}
                onFurther={further}
                onOpen={setOpen}
              />
            </Scroller>
          )
        }
      />
    </InsideProject>
  );

  function Branches() {
    return (
      <Region label={t("Branches")} className="text-[13.5px]">
        <Stack gap="tight">
          <Text as="span" size="sm" tone="faint" className="px-1">
            {t("Branches")}
          </Text>
          {branches.length === 0 ? (
            <Text tone="muted" size="sm" className="px-1">
              {t("Nothing has been committed yet.")}
            </Text>
          ) : (
            <Listing>
              {branches.map((b) => (
                <ListingItem key={b.name}>
                  {/* Not a button. Switching branches is a write, and this
                      screen does not write — a row that looks pressable and
                      does nothing is worse than a row that does not. */}
                  <Row gap="tight" className="rounded-md px-1.5 py-1">
                    <GitBranchIcon
                      size={12}
                      className={b.current ? "shrink-0 text-clay" : "shrink-0 text-ink-faint"}
                    />
                    <Text
                      as="span"
                      size="sm"
                      className={b.current ? "truncate font-medium text-clay" : "truncate"}
                    >
                      {b.name}
                    </Text>
                    {b.current ? (
                      <Badge tone="clay" title={t("The branch you are on")}>
                        {t("here")}
                      </Badge>
                    ) : null}
                    <Mono tone="faint" className="ml-auto shrink-0">
                      {b.head}
                    </Mono>
                  </Row>
                </ListingItem>
              ))}
            </Listing>
          )}
        </Stack>
      </Region>
    );
  }
}

function History({
  commits,
  more,
  loading,
  onFurther,
  onOpen,
}: {
  commits: Commit[];
  more: boolean;
  loading: boolean;
  onFurther: () => void;
  onOpen: (sha: string) => void;
}) {
  const t = useText();
  const now = Date.now();

  if (commits.length === 0) {
    return (
      <Inset>
        <Text tone="muted" size="sm">
          {loading ? t("Reading the history…") : t("Nothing has been committed yet.")}
        </Text>
      </Inset>
    );
  }

  return (
    <Stack gap="none">
      {byDay(commits).map((day) => (
        <Stack key={day.key} gap="none">
          {/* A heading per day, the way GitHub has it. A flat list of forty
              commits gives no sense of pace, and "eleven of these landed
              yesterday" is most of what a supervisor wants from a history. */}
          <Row
            gap="tight"
            className="sticky top-0 z-10 border-line-soft border-y bg-surface px-4 py-1.5"
          >
            <Text as="span" size="sm" tone="muted">
              {t("Commits on {day}", { day: onDay(day.at) })}
            </Text>
            <Text as="span" size="sm" tone="faint" className="ml-auto tabular-nums">
              {t.plural(day.commits.length, "{n} commit", "{n} commits")}
            </Text>
          </Row>
          {day.commits.map((c) => (
            <RowButton
              key={c.sha}
              onClick={() => onOpen(c.sha)}
              className="gap-3 rounded-none border-line-soft border-b px-4 py-2.5"
            >
              <Stack gap="none" className="min-w-0 flex-1">
                <Text as="span" className="truncate">
                  {c.subject || t("(no message)")}
                </Text>
                <Row gap="tight">
                  <Text as="span" size="sm" tone="faint">
                    {c.author}
                  </Text>
                  <Text as="span" size="sm" tone="faint">
                    ·
                  </Text>
                  <Since when={c.when} now={now} />
                </Row>
              </Stack>
              <Mono tone="faint" className="shrink-0">
                {c.short}
              </Mono>
            </RowButton>
          ))}
        </Stack>
      ))}
      {more ? (
        <Inset>
          <Button tone="outline" size="sm" onClick={onFurther} disabled={loading}>
            {loading ? t("Reading…") : t("Older")}
          </Button>
        </Inset>
      ) : null}
    </Stack>
  );
}

/// The date, spelled the way the reader's own machine spells one.
///
/// `Intl` rather than a format of our own: a date is one of the few things
/// every operating system already has an opinion about, and disagreeing with
/// it gains nothing.
export function onDay(at: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(at);
}
