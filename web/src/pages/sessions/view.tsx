import { useCallback, useEffect, useState } from "react";
import type { Session } from "@/core/sessions";
import { loadSessions } from "@/core/sessions";
import { live } from "@/core/live";
import { Badge, RowButton, Text } from "@/components";
import { Banner, EmptyState } from "@/composites";
import { Inset, Listing, ListingItem, Measure, Region, Row, Scroller, Stack } from "@/frame";
import { Panes } from "@/layouts";
import { InsideProject, type Inside } from "@/pages/_shared";
import { SessionCard } from "@/pages/sessions/card";
import { Since } from "@/pages/git/since";
import { useText } from "@/lib/language";

/// Which sessions there are, newest first, and which of them wants you.
///
/// Its own component so the probe mounts what ships. Written twice, the copy
/// drifted within the hour — it showed the id on both lines of a session
/// that had never been given a title.
export function SessionIndex({
  sessions,
  picked,
  onPick,
  now,
}: {
  sessions: Session[];
  picked: string | null;
  onPick: (id: string) => void;
  now: number;
}) {
  const t = useText();
  return (
    <Region label={t("Sessions")} className="text-[13.5px]">
      <Listing>
        {sessions.map((s) => (
          <ListingItem key={s.id}>
            <RowButton
              onClick={() => onPick(s.id)}
              selected={s.id === picked}
              className="items-start gap-1.5"
            >
              <Stack gap="none" className="min-w-0 flex-1">
                <Text as="span" size="sm" className="truncate">
                  {s.title ?? s.id.slice(0, 8)}
                </Text>
                <Row gap="tight">
                  {s.waiting ? <Badge tone="clay">{t("waiting")}</Badge> : null}
                  {/* Plain, not clay, and for the same reason as `kept`
                      below: where you are is a fact about the list, not a
                      summons. Without it the session you had just opened
                      was the only row on the screen wearing nothing. */}
                  {s.current ? <Badge>{t("current")}</Badge> : null}
                  {/* Plain, not clay: clay means "this wants you", and a
                      kept session is one you told the queue to go on asking
                      about — which is a setting, not a summons. */}
                  {s.kept ? <Badge>{t("kept")}</Badge> : null}
                  <Since when={Math.floor(s.at / 1000)} now={now} />
                </Row>
              </Stack>
            </RowButton>
          </ListingItem>
        ))}
      </Listing>
    </Region>
  );
}

/// Which sessions are here, and what the one you picked is stopped on.
///
/// A chooser and a detail, not a pile. Stacked, the one that wants you was
/// somewhere in a column of everything that does not. The pick is held above
/// this screen because the conversation beside it shows the same session,
/// and two picks would let the two halves of one screen disagree.
export function SessionsPage(
  inside: Inside & {
    sessions: Session[] | null;
    failed: string | null;
    picked: string | null;
    onPick: (id: string) => void;
    onKeep: (session: string, kept: boolean) => void;
  },
) {
  const t = useText();
  const { sessions, failed, picked, onPick, onKeep } = inside;

  const now = Date.now();
  const open = sessions?.find((s) => s.id === picked) ?? null;

  const body = failed ? (
    <Inset>
      <Banner label={t("Could not read the sessions")} tone="alarm">
        <Text as="span" size="sm" tone="alarm">
          {failed}
        </Text>
      </Banner>
    </Inset>
  ) : sessions === null ? (
    <Inset>
      <Text tone="muted" size="sm">
        {t("Reading the sessions…")}
      </Text>
    </Inset>
  ) : sessions.length === 0 ? (
    <Inset pad="loose">
      <EmptyState
        mark
        headline={t("No session has run here yet.")}
        detail={t("When one does, what it is doing and what it last said will be here.")}
      />
    </Inset>
  ) : open ? (
    <Scroller className="min-h-0 flex-1">
      <Inset pad="loose">
        {/* Held to a reading width. What is in the card is prose, and prose
            run across a wide monitor is a line you lose your place in
            returning from — the same reason the message screen is measured. */}
        <Measure>
          <SessionCard session={open} now={now} onKeep={(kept) => onKeep(open.id, kept)} />
        </Measure>
      </Inset>
    </Scroller>
  ) : null;

  return (
    <InsideProject {...inside}>
      <Panes
        index={
          <SessionIndex sessions={sessions ?? []} picked={picked} onPick={onPick} now={now} />
        }
        subject={
          <Stack gap="none" className="min-h-0 flex-1">
            {body}
          </Stack>
        }
      />
    </InsideProject>
  );
}

/// The sessions of one project, kept current.
///
/// Lifted out of the screen because the chat panel needs the same list — for
/// its picker — and two readings of "which sessions are here" is how a
/// product ends up disagreeing with itself about what is waiting.
export function useSessions(project: string) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const read = useCallback(() => {
    // Called from the shell, which holds the pick for every screen and so
    // runs outside a project too. Asking for the sessions of nowhere is a
    // round trip whose only possible answer is an error — and the last
    // project's list must go with it, or the next one opens showing them.
    if (!project) {
      setSessions(null);
      setFailed(null);
      return;
    }
    loadSessions(project)
      .then((s) => {
        setSessions(s);
        setFailed(null);
      })
      .catch((e) => setFailed(String(e)));
  }, [project]);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) read();
    };
    tick();
    const channel = live(tick);
    return () => {
      alive = false;
      channel.stop();
    };
  }, [read]);

  return { sessions, failed };
}
