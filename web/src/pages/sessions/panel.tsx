import { useCallback, useEffect, useRef, useState } from "react";
import { CaretDownIcon, XIcon } from "@phosphor-icons/react";
import type { Said } from "@/core/chat";
import { clampWidth, rememberWidth, width as storedWidth } from "@/core/appearance";
import type { Side } from "@/core/appearance";
import { loadChat } from "@/core/chat";
import type { Session } from "@/core/sessions";
import { live } from "@/core/live";
import { Badge, Button, Popover, RowButton, Text } from "@/components";
import { Resizable, Row, Scroller, Stack } from "@/frame";
import { Talk } from "@/pages/sessions/talk";
import { cn } from "@/lib/cn";
import { useText } from "@/lib/language";

/// The sessions to choose between, without the popover around them.
///
/// Split out because opening a Radix portal in a test costs about seven
/// seconds, and one wiring test through the trigger paid forty-nine of them
/// for what this asserts directly. The same trade the diff filter made.
export function SessionList({
  sessions,
  session,
  onSession,
}: {
  sessions: Session[];
  session: string | null;
  onSession: (id: string) => void;
}) {
  const t = useText();
  return (
    <Stack gap="none">
      {sessions.map((s) => (
        <RowButton
          key={s.id}
          onClick={() => onSession(s.id)}
          selected={s.id === session}
          className="items-start gap-2 px-2 py-1.5"
        >
          <Stack gap="none" className="min-w-0 flex-1">
            <Text as="span" size="sm" className="truncate">
              {s.title ?? s.id.slice(0, 8)}
            </Text>
            <Text as="span" size="sm" tone="faint">
              {s.id.slice(0, 8)}
            </Text>
          </Stack>
          {s.waiting ? <Badge tone="clay">{t("waiting")}</Badge> : null}
        </RowButton>
      ))}
    </Stack>
  );
}

/// The conversation of one session, beside whatever else you are reading.
///
/// It keeps its own session rather than following the screen: on the file
/// pane there is no session to follow, and a panel that emptied itself when
/// you changed tab is a panel you re-open every time.
export function ChatPanel({
  project,
  sessions,
  session,
  onSession,
  onClose,
  side = "right",
}: {
  project: string;
  sessions: Session[];
  session: string | null;
  onSession: (id: string) => void;
  onClose: () => void;
  side?: Side;
}) {
  const t = useText();
  const [width, setWidth] = useState(storedWidth);
  useEffect(() => rememberWidth(width), [width]);
  const [said, setSaid] = useState<Said[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const page = useCallback(
    (skip: number) => {
      if (!session) return;
      setLoading(true);
      loadChat(project, session, skip)
        .then((c) => {
          setMore(c.more);
          // Older ones go in front: the list reads downward, and asking for
          // a page is walking backwards through it.
          setSaid((have) => (skip === 0 ? c.said : [...c.said, ...have]));
          setFailed(null);
        })
        .catch((e) => setFailed(String(e)))
        .finally(() => setLoading(false));
    },
    [project, session],
  );

  useEffect(() => {
    let alive = true;
    setSaid([]);
    const tick = () => {
      // The newest page only. A conversation being added to grows at the
      // end, and re-reading the older pages would scroll the reader away
      // from what just arrived.
      if (alive) page(0);
    };
    tick();
    const channel = live(tick);
    return () => {
      alive = false;
      channel.stop();
    };
  }, [page]);

  // Where the thread is scrolled.
  //
  // A conversation opens at its end, and follows new messages only while you
  // are already at the end. Followed unconditionally it would yank the page
  // out from under somebody reading back through this morning; not followed
  // at all, the newest message arrives off-screen in the one surface whose
  // whole subject is what just happened.
  const thread = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);
  const older = useRef<number | null>(null);

  const watch = (e: { currentTarget: HTMLDivElement }) => {
    const el = e.currentTarget;
    // A few pixels of slack: a fractional scroll height from a zoom level
    // means an untouched thread is never exactly at the bottom.
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  useEffect(() => {
    const el = thread.current;
    // Nothing to be at the bottom of yet. The guard is also what tells the
    // linter this effect is about the thread and not about the refs it
    // reads — which is true, and the reason `said` is the dependency.
    if (!el || said.length === 0) return;
    // Older ones went in at the front, so holding the position means putting
    // back exactly what the prepended page added.
    if (older.current !== null) {
      el.scrollTop += el.scrollHeight - older.current;
      older.current = null;
      return;
    }
    if (pinned.current) el.scrollTop = el.scrollHeight;
  }, [said]);

  const readOlder = () => {
    older.current = thread.current?.scrollHeight ?? null;
    page(said.length);
  };

  const open = sessions.find((s) => s.id === session);

  return (
    <Resizable
      width={width}
      onWidth={(px) => setWidth(clampWidth(px))}
      side={side}
      label={t("Drag to resize the conversation")}
      className={cn(
        "bg-ground",
        side === "right" ? "border-line border-l" : "border-line border-r",
      )}
    >
      <Row gap="snug" className="shrink-0 border-line border-b bg-surface px-3 py-2">
        <Popover
          label={t("Which session")}
          align="start"
          className="w-72"
          trigger={
            <Button tone="ghost" size="sm" className="min-w-0 gap-1.5 px-1.5">
              <Text as="span" size="sm" className="truncate">
                {open?.title ?? session?.slice(0, 8) ?? t("No session")}
              </Text>
              <CaretDownIcon size={11} />
            </Button>
          }
        >
          <SessionList sessions={sessions} session={session} onSession={onSession} />
        </Popover>

        <Button
          tone="ghost"
          size="sm"
          onClick={onClose}
          className="ml-auto shrink-0 px-1.5"
          aria-label={t("Hide the conversation")}
          title={t("Hide the conversation")}
        >
          <XIcon size={13} />
        </Button>
      </Row>

      <Scroller ref={thread} onScroll={watch} className="min-h-0 flex-1">
        {failed ? (
          <Text tone="alarm" size="sm" className="p-3 [overflow-wrap:anywhere]">
            {failed}
          </Text>
        ) : (
          <Talk said={said} more={more} loading={loading} onOlder={readOlder} />
        )}
      </Scroller>
    </Resizable>
  );
}
