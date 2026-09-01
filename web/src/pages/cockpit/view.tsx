import { GearSixIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import { Button, Text } from "@/components";
import { Banner, EmptyState } from "@/composites";
import { Row, Stack } from "@/frame";
import { AppShell } from "@/layouts";
import { Elsewhere, WipBar } from "@/pages/_shared";
import { Group } from "@/pages/cockpit/group";

/// What needs you, and nothing else.
///
/// At rest this screen is empty on purpose. The moment something appears
/// here that needs no action, the whole queue stops being read.
export function CockpitView({
  queue,
  mute,
  onOpenProject,
  onOpenSettings,
}: {
  queue: Queue;
  mute: string | null;
  onOpenProject: (project: string) => void;
  onOpenSettings: () => void;
}) {
  return (
    <AppShell
      title="Needs you"
      banner={<Elsewhere path={queue.elsewhere} />}
      aside={
        <Row gap="normal">
          <WipBar wip={queue.wip} />
          <Button tone="ghost" size="icon" onClick={onOpenSettings} aria-label="Settings">
            <GearSixIcon size={16} />
          </Button>
        </Row>
      }
    >
      <Stack gap="snug">
        {queue.groups.length === 0 ? (
          <EmptyState
            headline="Nothing needs you."
            detail={
              queue.watching === 0
                ? "No projects registered yet."
                : `Watching ${queue.watching} project${queue.watching === 1 ? "" : "s"}.`
            }
            action={
              // Only when there is nothing to watch. An empty cockpit that
              // *is* watching is the product working, and a call to action
              // there would make the good state look like a problem.
              queue.watching === 0 ? (
                <Button tone="primary" onClick={onOpenSettings}>
                  Register one
                </Button>
              ) : undefined
            }
          />
        ) : (
          queue.groups.map((g) => <Group key={g.session} group={g} onOpen={onOpenProject} />)
        )}

        {mute ? (
          <Banner label="Cannot reach you outside this window" tone="alarm">
            <Text as="span" size="sm" tone="alarm">
              {mute}
            </Text>
          </Banner>
        ) : null}

        {queue.unreachable.length > 0 ? (
          <Banner label="Could not read" tone="alarm">
            <Text as="span" size="sm" tone="alarm">
              {queue.unreachable.join(", ")}
            </Text>
          </Banner>
        ) : null}
      </Stack>
    </AppShell>
  );
}
