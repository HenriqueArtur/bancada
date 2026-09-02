import { ArrowCounterClockwiseIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { CLOSEST, FURTHEST, percent } from "@/core/zoom";
import { Button, Card, Text } from "@/components";
import { Section } from "@/composites";
import { Inset, Row } from "@/frame";
import { useText } from "@/lib/language";

/// How large the window draws itself.
///
/// The buttons are here because a setting nobody can find is a setting that
/// does not exist — but the keys are what anybody will actually use, so they
/// are printed beside them rather than left to be discovered.
export function ZoomPanel({
  level,
  onChoose,
}: {
  level: number;
  onChoose: (level: number) => void;
}) {
  const t = useText();

  return (
    <Section title={t("Size")}>
      <Card>
        <Row gap="normal" justify="between" className="px-4 py-3.5">
          <Row gap="snug" align="baseline">
            <Text className="tabular-nums">{t("{n}%", { n: percent(level) })}</Text>
            {level === 0 ? null : (
              <Text as="span" size="sm" tone="faint">
                {t("was 100%")}
              </Text>
            )}
          </Row>
          <Row gap="tight">
            <Button
              tone="outline"
              size="sm"
              onClick={() => onChoose(level - 1)}
              disabled={level <= CLOSEST}
              aria-label={t("Smaller")}
              title={t("Smaller")}
            >
              <MinusIcon size={13} />
            </Button>
            <Button
              tone="outline"
              size="sm"
              onClick={() => onChoose(level + 1)}
              disabled={level >= FURTHEST}
              aria-label={t("Bigger")}
              title={t("Bigger")}
            >
              <PlusIcon size={13} />
            </Button>
            <Button
              tone="ghost"
              size="sm"
              onClick={() => onChoose(0)}
              disabled={level === 0}
              aria-label={t("Back to 100%")}
              title={t("Back to 100%")}
            >
              <ArrowCounterClockwiseIcon size={13} />
            </Button>
          </Row>
        </Row>
      </Card>
      <Inset pad="none">
        <Text size="sm" tone="faint">
          {t(
            "⌘+ and ⌘− anywhere in the window, and ⌘0 to come back. Kept in this window, not in the configuration: how big the text is belongs to whoever is reading this screen.",
          )}
        </Text>
      </Inset>
    </Section>
  );
}
