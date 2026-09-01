import { useState } from "react";
import { DesktopTowerIcon, StackIcon } from "@phosphor-icons/react";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { SettingsDialog } from "@/layouts";
import { useSettings } from "@/pages/settings/logic";
import { ProjectsPanel } from "@/pages/settings/projects";
import { MachinesPanel } from "@/pages/settings/machines";

/// What the product was told, in a window over what it is telling you.
export function SettingsPage({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const { config, failed, register, forget, addRuntime } = useSettings(onChanged);
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
          id: "machines",
          label: "Machines",
          icon: <DesktopTowerIcon size={15} />,
          blurb: "Where sessions run, and what each one turned out to have.",
          panel:
            body ?? (config ? <MachinesPanel config={config} onRegister={addRuntime} /> : null),
        },
      ]}
    />
  );
}
