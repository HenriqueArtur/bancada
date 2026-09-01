import type { ReactNode } from "react";
import { Dialog, DialogFrame, Heading, RowButton, Text } from "@/components";
import { Divider, Inset, Region, Scroller, Stack } from "@/frame";
import { useText } from "@/lib/language";

export interface SettingsSection {
  id: string;
  label: string;
  icon: ReactNode;
  /// One line under the title, saying what this section is for.
  blurb: string;
  panel: ReactNode;
}

/// Settings as a window over the page, with its sections down the side.
///
/// A window rather than a screen you navigate to: settings is somewhere you
/// go, do one thing, and leave. Making it a destination costs a back button
/// and loses the place you were — and the queue behind it stays visible
/// through the scrim, which is the point of a supervisor.
export function SettingsDialog({
  open,
  onOpenChange,
  sections,
  active,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: SettingsSection[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const t = useText();
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogFrame title={t("Settings")} description={t("What the product was told.")}>
        <Region label={t("Settings sections")} className="w-[212px] shrink-0 border-r border-line bg-surface">
          <Inset pad="snug">
            <Text as="div" size="xs" tone="faint" className="px-2 pb-1.5 uppercase tracking-wider">
              {t("Settings")}
            </Text>
            <Stack gap="none">
              {sections.map((s) => (
                <RowButton
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  selected={s.id === current?.id}
                  className={
                    s.id === current?.id
                      ? "gap-2.5 rounded-lg px-2.5 py-2 text-sm bg-raised text-ink shadow-raised"
                      : "gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted hover:text-ink"
                  }
                >
                  {s.icon}
                  {s.label}
                </RowButton>
              ))}
            </Stack>
          </Inset>
        </Region>

        <Scroller className="flex-1">
          <Inset pad="loose" className="pt-7">
            <Stack gap="normal">
              <Stack gap="none">
                <Heading level={1} as="h2">
                  {current?.label}
                </Heading>
                <Text tone="muted" size="sm">
                  {current?.blurb}
                </Text>
              </Stack>
              <Divider soft />
              {current?.panel}
            </Stack>
          </Inset>
        </Scroller>
      </DialogFrame>
    </Dialog>
  );
}
