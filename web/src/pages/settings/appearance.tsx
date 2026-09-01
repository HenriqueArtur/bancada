import { CircleHalfIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { THEMES, nameOf, type Theme } from "@/core/appearance";
import type { Translate } from "@/core/language";
import { Card, Heading, RowButton, Text } from "@/components";
import { Section } from "@/composites";
import { Divider, Inset, Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

const ICON: Record<Theme, ReactNode> = {
  system: <CircleHalfIcon size={16} />,
  light: <SunIcon size={16} />,
  dark: <MoonIcon size={16} />,
};

/// Built from the translator rather than declared as a constant, or the
/// phrases would sit outside any `t(…)` and the checker could not see them.
function blurbs(t: Translate): Record<Theme, string> {
  return {
    system: t("Whatever this machine is set to, and it keeps following."),
    light: t("Warm paper, whatever the machine says."),
    dark: t("The same room with the lights low."),
  };
}

/// Which palette the window wears.
export function AppearancePanel({
  theme,
  onChoose,
}: {
  theme: Theme;
  onChoose: (t: Theme) => void;
}) {
  const t = useText();
  const blurb = blurbs(t);
  return (
    <Section title={t("Palette")}>
      <Card>
        {THEMES.map((option, i) => (
          <Stack gap="none" key={option}>
            {i > 0 ? <Divider soft /> : null}
            <RowButton
              onClick={() => onChoose(option)}
              selected={option === theme}
              className="items-start gap-3 rounded-none px-4 py-3.5"
            >
              <Row gap="none" className="mt-0.5 shrink-0">
                {ICON[option]}
              </Row>
              <Stack gap="tight" className="min-w-0 flex-1">
                <Heading level={3} as="h3">
                  {nameOf(option, t)}
                </Heading>
                <Text size="sm" tone={option === theme ? "clay" : "faint"}>
                  {blurb[option]}
                </Text>
              </Stack>
            </RowButton>
          </Stack>
        ))}
      </Card>
      <Inset pad="none">
        <Text size="sm" tone="faint">
          {t(
            "Kept in this window, not in the configuration. A palette is a fact about whoever is reading, not about the work.",
          )}
        </Text>
      </Inset>
    </Section>
  );
}
