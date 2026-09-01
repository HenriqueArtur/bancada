import { GearSixIcon, StackIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import { Button, Text } from "@/components";
import { Banner, EmptyState } from "@/composites";
import { Row, Stack } from "@/frame";
import { AppShell } from "@/layouts";
import { Elsewhere, WipBar } from "@/pages/_shared";
import { Group } from "@/pages/cockpit/group";
import { useText } from "@/lib/language";

/// What needs you, and nothing else.
///
/// At rest this screen is empty on purpose. The moment something appears
/// here that needs no action, the whole queue stops being read.
export function CockpitView({
  queue,
  mute,
  onOpenProject,
  onOpenSettings,
  onOpenWork,
}: {
  queue: Queue;
  mute: string | null;
  onOpenProject: (project: string) => void;
  onOpenSettings: () => void;
  /// The other surface: everything being watched, waiting or not.
  onOpenWork: () => void;
}) {
  const t = useText();
  return (
    <AppShell
      title={t("Needs you")}
      banner={<Elsewhere path={queue.elsewhere} />}
      aside={
        <Row gap="normal">
          <Button tone="ghost" size="sm" onClick={onOpenWork}>
            <StackIcon size={14} />
            {t("Your work")}
          </Button>
          <WipBar wip={queue.wip} />
          <Button tone="ghost" size="icon" onClick={onOpenSettings} aria-label={t("Settings")}>
            <GearSixIcon size={16} />
          </Button>
        </Row>
      }
    >
      <Stack gap="snug">
        {queue.groups.length === 0 ? (
          <EmptyState
            headline={t("Nothing needs you.")}
            detail={
              queue.watching === 0
                ? t("No projects registered yet.")
                : t.plural(queue.watching, "Watching {n} project.", "Watching {n} projects.")
            }
            action={
              // With nothing registered the action is to register. With
              // something registered and nothing waiting, the product is
              // working — the only thing left to offer is a look at it.
              queue.watching === 0 ? (
                <Button tone="primary" onClick={onOpenSettings}>
                  {t("Register one")}
                </Button>
              ) : (
                <Button tone="outline" onClick={onOpenWork}>
                  {t("See what is being watched")}
                </Button>
              )
            }
          />
        ) : (
          queue.groups.map((g) => (
            <Group
              key={g.session}
              group={g}
              glance={queue.glances[g.session]}
              onOpen={onOpenProject}
            />
          ))
        )}

        {mute ? (
          <Banner label={t("Cannot reach you outside this window")} tone="alarm">
            <Text as="span" size="sm" tone="alarm">
              {mute}
            </Text>
          </Banner>
        ) : null}

        {queue.unreachable.length > 0 ? (
          <Banner label={t("Could not read")} tone="alarm">
            <Text as="span" size="sm" tone="alarm">
              {queue.unreachable.join(", ")}
            </Text>
          </Banner>
        ) : null}
      </Stack>
    </AppShell>
  );
}
