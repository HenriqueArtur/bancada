import { ColumnsPlusLeftIcon, ColumnsPlusRightIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { Side } from "@/core/appearance";
import { Card, Heading, RowButton, Text } from "@/components";
import { Section } from "@/composites";
import { Divider, Inset, Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

// "A column added on this side", which is exactly the setting. The first
// try mirrored one sidebar glyph, and at sixteen pixels the two were
// indistinguishable — a choice whose two icons look the same is a choice
// nobody makes from the icons.
const ICON: Record<Side, ReactNode> = {
  left: <ColumnsPlusLeftIcon size={16} />,
  right: <ColumnsPlusRightIcon size={16} />,
};

/// Which edge the conversation sits against.
///
/// Configurable rather than chosen for you because it competes with whatever
/// the screen itself puts at that edge — the file tree is on the left, and
/// two trees against one another is a worse screen than either side alone.
export function SidePanel({ side, onChoose }: { side: Side; onChoose: (s: Side) => void }) {
  const t = useText();
  const blurb: Record<Side, string> = {
    left: t("Against the same edge as the file tree."),
    right: t("Opposite the tree, out of the way of it."),
  };
  const name: Record<Side, string> = { left: t("Left"), right: t("Right") };

  return (
    <Section title={t("The conversation")}>
      <Card>
        {(["left", "right"] as const).map((option, i) => (
          <Stack gap="none" key={option}>
            {i > 0 ? <Divider soft /> : null}
            <RowButton
              onClick={() => onChoose(option)}
              selected={option === side}
              className="items-start gap-3 rounded-none px-4 py-3.5"
            >
              <Row gap="none" className="mt-0.5 shrink-0">
                {ICON[option]}
              </Row>
              <Stack gap="tight" className="min-w-0 flex-1">
                <Heading level={3} as="h3">
                  {name[option]}
                </Heading>
                <Text size="sm" tone={option === side ? "clay" : "faint"}>
                  {blurb[option]}
                </Text>
              </Stack>
            </RowButton>
          </Stack>
        ))}
      </Card>
      <Inset pad="none">
        <Text size="sm" tone="faint">
          {t("Shown on every screen inside a project, and hidden with its key.")}
        </Text>
      </Inset>
    </Section>
  );
}
