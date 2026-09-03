import { useState } from "react";
import {
  DesktopTowerIcon,
  KeyboardIcon,
  PaletteIcon,
  ShieldIcon,
  StackIcon,
  TranslateIcon,
} from "@phosphor-icons/react";
import type { Side, Theme } from "@/core/appearance";
import type { Language } from "@/core/language";
import type { Action, Chord } from "@/core/shortcuts";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { Stack } from "@/frame";
import { SettingsDialog } from "@/layouts";
import { useSettings } from "@/pages/settings/logic";
import { ProjectsPanel } from "@/pages/settings/projects";
import { MachinesPanel } from "@/pages/settings/machines";
import { WorkspacesPanel } from "@/pages/settings/workspaces";
import { AppearancePanel } from "@/pages/settings/appearance";
import { ZoomPanel } from "@/pages/settings/zoom";
import { SidePanel } from "@/pages/settings/side";
import { KeysPanel } from "@/pages/settings/keys";
import { LanguagePanel } from "@/pages/settings/language";
import { useText } from "@/lib/language";

/// What the product was told, in a window over what it is telling you.
export function SettingsPage({
  open,
  onOpenChange,
  onChanged,
  theme,
  onChooseTheme,
  language,
  onChooseLanguage,
  zoom,
  onChooseZoom,
  side,
  onChooseSide,
  keys,
  onChooseKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  theme: Theme;
  onChooseTheme: (t: Theme) => void;
  language: Language | null;
  onChooseLanguage: (l: Language | null) => void;
  zoom: number;
  onChooseZoom: (level: number) => void;
  side: Side;
  onChooseSide: (s: Side) => void;
  keys: Record<Action, Chord>;
  onChooseKeys: (keys: Record<Action, Chord>) => void;
}) {
  const { config, limits, failed, register, forget, addRuntime, addWorkspace, dropWorkspace } =
    useSettings(onChanged);
  const t = useText();
  const [active, setActive] = useState("projects");

  const body = failed ? (
    <Banner label={t("Could not read the configuration")} tone="alarm">
      <Text as="span" size="sm" tone="alarm">
        {failed}
      </Text>
    </Banner>
  ) : !config ? (
    <Text tone="muted" size="sm">
      {t("Reading the configuration…")}
    </Text>
  ) : null;

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      active={active}
      onSelect={setActive}
      sections={[
        {
          id: "projects",
          label: t("Projects"),
          icon: <StackIcon size={15} />,
          blurb: t("The bodies of content this cockpit is watching."),
          panel:
            body ??
            (config ? (
              <ProjectsPanel
                config={config}
                limits={limits}
                onRegister={register}
                onForget={forget}
              />
            ) : null),
        },
        {
          id: "workspaces",
          label: t("Workspaces"),
          icon: <ShieldIcon size={15} />,
          blurb: t("Who each project belongs to, and what its supervisor may let out."),
          panel: config ? (
            <WorkspacesPanel
              config={config}
              onRegister={addWorkspace}
              onForget={dropWorkspace}
              failed={failed}
            />
          ) : (
            body
          ),
        },
        {
          id: "machines",
          label: t("Machines"),
          icon: <DesktopTowerIcon size={15} />,
          blurb: t("Where sessions run, and what each one turned out to have."),
          panel:
            body ?? (config ? <MachinesPanel config={config} onRegister={addRuntime} /> : null),
        },
        {
          id: "appearance",
          label: t("Appearance"),
          icon: <PaletteIcon size={15} />,
          blurb: t("How the window looks while you read in it."),
          // All three live here: they are what the window looks like while
          // you read in it, and a section apiece would make the list longer
          // without making any of them easier to find.
          panel: (
            <Stack gap="loose">
              <AppearancePanel theme={theme} onChoose={onChooseTheme} />
              <ZoomPanel level={zoom} onChoose={onChooseZoom} />
              <SidePanel side={side} onChoose={onChooseSide} />
            </Stack>
          ),
        },
        {
          id: "keys",
          label: t("Keys"),
          icon: <KeyboardIcon size={15} />,
          blurb: t("Which keystroke does what, and what is already taken."),
          panel: <KeysPanel keys={keys} onChange={onChooseKeys} />,
        },
        {
          id: "language",
          label: t("Language"),
          icon: <TranslateIcon size={15} />,
          blurb: t("Which language the interface speaks."),
          panel: <LanguagePanel language={language} onChoose={onChooseLanguage} />,
        },
      ]}
    />
  );
}
