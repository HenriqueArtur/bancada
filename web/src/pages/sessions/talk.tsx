import { useState } from "react";
import { CaretRightIcon, WarningIcon } from "@phosphor-icons/react";
import type { Said, Step } from "@/core/chat";
import type { Question } from "@/core/sessions";
import { prose } from "@/core/prose";
import { Button, CodeBlock, Mono, Prose, Text } from "@/components";
import { Inset, Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

/// The conversation, read the way a conversation reads.
///
/// Nobody is named. Your words sit right in a bubble and the agent's sit
/// left in plain prose, which is how every messaging surface has said "who
/// spoke" for twenty years — a label over each message is a caption on
/// something that already reads.
export function Talk({
  said,
  more,
  loading,
  onOlder,
}: {
  said: Said[];
  more: boolean;
  loading: boolean;
  onOlder: () => void;
}) {
  const t = useText();

  if (said.length === 0) {
    return (
      <Inset>
        <Text tone="muted" size="sm">
          {t("Nothing said in this session yet.")}
        </Text>
      </Inset>
    );
  }

  return (
    <Stack gap="normal" className="px-3 py-4">
      {more ? (
        <Row gap="none" justify="center">
          <Button tone="ghost" size="sm" onClick={onOlder} disabled={loading}>
            {loading ? t("Reading…") : t("Older")}
          </Button>
        </Row>
      ) : null}

      {said.map((s, i) => (
        <Row
          // Position is the identity: the list comes from one parse in order
          // and only ever grows at the front.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          key={i}
          gap="none"
          align="start"
          justify={s.kind === "you" ? "end" : "start"}
        >
          {s.kind === "you" ? (
            <Stack
              gap="none"
              className="max-w-[85%] rounded-card bg-surface px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]"
            >
              {/* Kept as typed. What you wrote is not markdown you asked to
                  be rendered — it is the thing you said, and reformatting
                  somebody's own words back at them is a small lie. */}
              <Text as="span" size="sm">
                {s.text}
              </Text>
            </Stack>
          ) : s.kind === "asked" ? (
            <Asked question={s.question} />
          ) : s.kind === "steps" ? (
            <Steps steps={s.steps} />
          ) : (
            <Prose blocks={prose(s.text)} className="max-w-[95%] text-[14px]" />
          )}
        </Row>
      ))}
    </Stack>
  );
}

/// What it did between two things it said, closed.
///
/// Closed because a working turn is thirty calls and four sentences, and the
/// sentences are what a supervisor is reading for. Open, it is one row per
/// call and no more: the whole input is a hundred kilobytes of edit for a
/// line that shows forty characters.
function Steps({ steps }: { steps: Step[] }) {
  const t = useText();
  const [open, setOpen] = useState(false);
  const broke = steps.filter((s) => !s.ok).length;

  return (
    <Stack gap="none" className="w-full">
      <Row gap="tight" className="min-w-0">
        <Button
          tone="ghost"
          size="sm"
          onClick={() => setOpen((now) => !now)}
          aria-expanded={open}
          className="min-w-0 gap-1.5 px-1.5 text-ink-faint"
        >
          <CaretRightIcon
            size={11}
            className={open ? "rotate-90 transition-transform" : "transition-transform"}
          />
          {t.plural(steps.length, "{n} step", "{n} steps")}
        </Button>
        {broke > 0 ? (
          <Row gap="tight" className="shrink-0 text-alarm">
            <WarningIcon size={11} />
            <Text as="span" size="sm" tone="alarm">
              {t.plural(broke, "{n} failed", "{n} failed")}
            </Text>
          </Row>
        ) : null}
      </Row>

      {open ? (
        <Stack gap="none" className="mt-1 ml-2 border-line border-l pl-3">
          {steps.map((s, i) => (
            // Position is the identity: one parse, in order, never reordered.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <Row key={i} gap="snug" align="baseline" className="min-w-0 py-0.5">
              <Text as="span" size="sm" tone={s.ok ? "muted" : "alarm"} className="shrink-0">
                {s.tool}
              </Text>
              <Mono tone="faint" className="min-w-0 truncate text-xs">
                {s.target}
              </Mono>
            </Row>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

/// A question, as the cards it already is in the log.
///
/// Not pickable, and it says so. Answering arrives with 0.3; what this buys
/// now is that you stop opening the terminal to *read* — you open it to
/// answer, already knowing what you will say.
function Asked({ question }: { question: Question }) {
  const t = useText();

  return (
    <Stack gap="snug" className="w-full [overflow-wrap:anywhere]">
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
