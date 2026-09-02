import type { ReactNode } from "react";
import type { Question, Session } from "@/core/sessions";
import { prose } from "@/core/prose";
import { Badge, Card, CodeBlock, Mono, Prose, Text, Toggle } from "@/components";
import { Divider, Inset, Row, Stack } from "@/frame";
import { Since } from "@/pages/git/since";
import { useText } from "@/lib/language";

/// One session, as the last exchange in it.
///
/// The end of the log and not the middle. What a session did is the diff's
/// business; what this answers is whether it is stopped, on what, and what
/// the two of you last said to each other.
export function SessionCard({
  session,
  now,
  onKeep,
}: {
  session: Session;
  now: number;
  /// Hold this session back from the rule that quiets it once a newer one
  /// begins, or let it go. Required rather than optional: a card mounted
  /// without it would show a state and hide its switch, which is the one
  /// shape this control exists to prevent.
  onKeep: (kept: boolean) => void;
}) {
  const t = useText();

  return (
    <Card>
      <Inset pad="normal">
        <Stack gap="snug">
          <Row gap="snug" align="baseline" wrap>
            <Mono tone="faint">{session.id.slice(0, 8)}</Mono>
            {session.waiting ? <Badge tone="clay">{t("Waiting on you")}</Badge> : null}
            <Row gap="none" className="ml-auto">
              <Since when={Math.floor(session.at / 1000)} now={now} />
            </Row>
          </Row>

          {session.title ? (
            <Text className="line-clamp-2 font-medium">{session.title}</Text>
          ) : null}

          <Divider soft />

          {/* What you said, first, and whole. The exchange reads as one
              thing, and the agent's answer only means something beside the
              ask. Truncated to a line it used to end mid-sentence, which is
              the one shape that reads as if nothing were missing. */}
          {session.heard ? (
            <Stack gap="tight">
              <Label>{t("What you asked for")}</Label>
              {/* Kept as typed rather than parsed. What you wrote is not
                  markdown you asked to be rendered — it is the thing you
                  said, and reformatting somebody's own words back at them
                  is a small lie. */}
              <Text
                as="div"
                size="sm"
                className="max-h-40 overflow-y-auto rounded-card bg-surface px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]"
              >
                {session.heard}
              </Text>
            </Stack>
          ) : null}

          <Divider soft />

          <Stack gap="tight">
            <Label>{session.asked ? t("What it is stopped on") : t("What it said back")}</Label>
            {session.asked ? (
              <Asked question={session.asked} />
            ) : session.said ? (
              <Prose blocks={prose(session.said)} className="text-[14px]" />
            ) : (
              <Text tone="faint" size="sm">
                {t("Nothing said yet.")}
              </Text>
            )}
          </Stack>

          <Divider soft />

          {/* The switch and the reason for the silence, on one line. A
              session quiet because you moved on and a session quiet because
              nothing happened look identical, and only one of them can be
              undone — so the sentence that says which sits beside the thing
              that undoes it. */}
          <Row gap="snug" align="center" wrap>
            <Toggle
              on={session.kept}
              onChange={onKeep}
              label={t("Keep asking")}
              hint={t(
                "A newer session quiets the ones that had already stopped. Not this one.",
              )}
            />
            {session.quieted ? (
              <Text as="span" size="sm" tone="faint">
                {t("Quieted by a newer session.")}
              </Text>
            ) : null}
            {/* The other side of the same silence, and never both: a
                session's own activity is at least its own beginning, so the
                one you moved to always speaks for itself. Said here rather
                than only as a badge because this is where the rule is
                explained, and the rule had only ever been shown from the
                end where something goes quiet. */}
            {session.current ? (
              <Text as="span" size="sm" tone="faint">
                {t("The session you moved to.")}
              </Text>
            ) : null}
          </Row>
        </Stack>
      </Inset>
    </Card>
  );
}

/// The question it is stopped on, drawn as the cards it already is.
///
/// Not pickable, and it says so. Answering arrives with 0.3; until then the
/// value is that you stop opening the terminal to *read* — you open it to
/// answer, already knowing what you will say. Cards you cannot pick without
/// a word about why are a promise the screen does not keep.
function Asked({ question }: { question: Question }) {
  const t = useText();

  return (
    <Stack gap="snug">
      <Text className="font-medium">{question.prompt || question.header}</Text>

      <Stack gap="tight">
        {question.options.map((o) => (
          <Stack key={o.label} gap="none" className="rounded-card border border-line px-3 py-2">
            <Text as="span" size="sm" className="font-medium">
              {o.label}
            </Text>
            {o.description ? (
              <Text as="span" size="sm" tone="muted">
                {o.description}
              </Text>
            ) : null}
            {o.preview ? (
              <CodeBlock
                className="mt-2 rounded-lg border-0"
                lines={o.preview
                  .split("\n")
                  .map((text) => ({ kind: "context" as const, text }))}
              />
            ) : null}
          </Stack>
        ))}
      </Stack>

      <Text size="sm" tone="faint">
        {question.multi
          ? t("Several may be chosen. Answer it in the terminal.")
          : t("Answer it in the terminal.")}
      </Text>
    </Stack>
  );
}

/// Which half of the exchange you are reading.
///
/// Small caps and letter-spaced rather than merely dimmer. Set faint, the
/// two labels read as decoration and the card became one wall of text with
/// a paler line somewhere in it — which is exactly what a reader skips.
function Label({ children }: { children: ReactNode }) {
  return (
    <Text
      as="span"
      size="sm"
      tone="muted"
      className="font-medium text-[11px] uppercase tracking-[0.08em]"
    >
      {children}
    </Text>
  );
}
