import { useState } from "react";
import { DesktopTowerIcon, PaletteIcon, ShieldIcon, StackIcon } from "@phosphor-icons/react";
import type { Theme } from "@/core/appearance";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { SettingsDialog } from "@/layouts";
import { useSettings } from "@/pages/settings/logic";
import { ProjectsPanel } from "@/pages/settings/projects";
import { MachinesPanel } from "@/pages/settings/machines";
import { WorkspacesPanel } from "@/pages/settings/workspaces";
import { AppearancePanel } from "@/pages/settings/appearance";

/// What the product was told, in a window over what it is telling you.
export function SettingsPage({
  open,
  onOpenChange,
  onChanged,
  theme,
  onChooseTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  theme: Theme;
  onChooseTheme: (t: Theme) => void;
}) {
  const { config, failed, register, forget, addRuntime, addWorkspace, dropWorkspace } =
    useSettings(onChanged);
  const [active, setActive] = useState("projects");

  const body = failed ? (
    <Banner label="Could not read the configuration" tone="alarm">
      <Text as="span" size="sm" tone="alarm">
        {failed}
      </Text>
    </Banner>
  ) : !config ? (
    <Text tone="muted" size="sm">
      Reading the configuration…
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
          label: "Projects",
          icon: <StackIcon size={15} />,
          blurb: "The bodies of content this cockpit is watching.",
          panel:
            body ??
            (config ? (
              <ProjectsPanel config={config} onRegister={register} onForget={forget} />
            ) : null),
        },
        {
          id: "workspaces",
          label: "Workspaces",
          icon: <ShieldIcon size={15} />,
          blurb: "Who each project belongs to, and what its supervisor may let out.",
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
          label: "Machines",
          icon: <DesktopTowerIcon size={15} />,
          blurb: "Where sessions run, and what each one turned out to have.",
          panel:
            body ?? (config ? <MachinesPanel config={config} onRegister={addRuntime} /> : null),
        },
        {
          id: "appearance",
          label: "Appearance",
          icon: <PaletteIcon size={15} />,
          blurb: "How the window looks while you read in it.",
          panel: <AppearancePanel theme={theme} onChoose={onChooseTheme} />,
        },
      ]}
    />
  );
}
