import { useEffect, useState } from "react";
import { ACTIONS, chord, clash, forget, nameOf, rebind, spell } from "@/core/shortcuts";
import type { Action, Chord } from "@/core/shortcuts";
import { Button, Card, Text } from "@/components";
import { Section } from "@/composites";
import { Divider, Inset, Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

/// Which key does what.
///
/// One registry behind it, so a keystroke has one owner and a clash is
/// refused with the name of whoever already has it. Before this, the zoom
/// listened for its own keys inside the shell and nothing knew what was
/// taken.
export function KeysPanel({
  keys,
  onChange,
}: {
  keys: Record<Action, Chord>;
  onChange: (keys: Record<Action, Chord>) => void;
}) {
  const t = useText();
  const [taking, setTaking] = useState<Action | null>(null);
  const [taken, setTaken] = useState<Action | null>(null);
  const apple = navigator.platform.startsWith("Mac");

  useEffect(() => {
    if (!taking) return;
    const listen = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setTaking(null);
        setTaken(null);
        return;
      }
      // A bare modifier is on its way to a real key, and an unmodified one
      // is not a shortcut at all — bound, it would fire while you type.
      const said = chord(e);
      if (!said) return;

      const owner = clash(keys, taking, said);
      if (owner) {
        setTaken(owner);
        return;
      }
      onChange(rebind(taking, said));
      setTaking(null);
      setTaken(null);
    };
    window.addEventListener("keydown", listen, true);
    return () => window.removeEventListener("keydown", listen, true);
  }, [taking, keys, onChange]);

  return (
    <Section title={t("Keys")}>
      <Card>
        {ACTIONS.map((a, i) => (
          <Stack gap="none" key={a}>
            {i > 0 ? <Divider soft /> : null}
            <Row gap="normal" justify="between" className="px-4 py-3">
              <Stack gap="none" className="min-w-0">
                <Text as="span" size="sm">
                  {nameOf(a, t)}
                </Text>
                {taking === a ? (
                  <Text as="span" size="sm" tone="clay">
                    {taken
                      ? t("{who} already answers to that one.", { who: nameOf(taken, t) })
                      : t("Press the keys…")}
                  </Text>
                ) : null}
              </Stack>
              <Row gap="tight" className="shrink-0">
                {/* A fixed column, right-aligned. `⌘⇧]` is three glyphs and
                    `⌘B` is two, and left to themselves the buttons beside
                    them stepped left and right down the list. */}
                <Text
                  as="span"
                  size="sm"
                  tone="muted"
                  className="w-14 shrink-0 text-right tabular-nums"
                >
                  {spell(keys[a], apple)}
                </Text>
                <Button
                  tone="outline"
                  size="sm"
                  onClick={() => {
                    setTaken(null);
                    setTaking(taking === a ? null : a);
                  }}
                >
                  {taking === a ? t("Cancel") : t("Change")}
                </Button>
                <Button tone="ghost" size="sm" onClick={() => onChange(forget(a))}>
                  {t("Reset")}
                </Button>
              </Row>
            </Row>
          </Stack>
        ))}
      </Card>
      <Inset pad="none">
        <Text size="sm" tone="faint">
          {t(
            "Kept in this window, not in the configuration. Which key does what belongs to whoever is typing on this machine.",
          )}
        </Text>
      </Inset>
    </Section>
  );
}
