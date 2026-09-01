import { CircleHalfIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { THEMES, nameOf, type Theme } from "@/core/appearance";
import { Card, Heading, RowButton, Text } from "@/components";
import { Section } from "@/composites";
import { Divider, Inset, Row, Stack } from "@/frame";

const ICON: Record<Theme, ReactNode> = {
  system: <CircleHalfIcon size={16} />,
  light: <SunIcon size={16} />,
  dark: <MoonIcon size={16} />,
};

const BLURB: Record<Theme, string> = {
  system: "Whatever this machine is set to, and it keeps following.",
  light: "Warm paper, whatever the machine says.",
  dark: "The same room with the lights low.",
};

/// Which palette the window wears.
export function AppearancePanel({
  theme,
  onChoose,
}: {
  theme: Theme;
  onChoose: (t: Theme) => void;
}) {
  return (
    <Section title="Palette">
      <Card>
        {THEMES.map((t, i) => (
          <Stack gap="none" key={t}>
            {i > 0 ? <Divider soft /> : null}
            <RowButton
              onClick={() => onChoose(t)}
              selected={t === theme}
              className="items-start gap-3 rounded-none px-4 py-3.5"
            >
              <Row gap="none" className="mt-0.5 shrink-0">
                {ICON[t]}
              </Row>
              <Stack gap="tight" className="min-w-0 flex-1">
                <Heading level={3} as="h3">
                  {nameOf(t)}
                </Heading>
                <Text size="sm" tone={t === theme ? "clay" : "faint"}>
                  {BLURB[t]}
                </Text>
              </Stack>
            </RowButton>
          </Stack>
        ))}
      </Card>
      <Inset pad="none">
        <Text size="sm" tone="faint">
          Kept in this window, not in the configuration. A palette is a fact
          about whoever is reading, not about the work.
        </Text>
      </Inset>
    </Section>
  );
}
