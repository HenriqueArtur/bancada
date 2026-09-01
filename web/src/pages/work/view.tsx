import { ArrowRightIcon, GearSixIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import type { Grouped, Standing } from "@/core/work";
import { aliveness, exportsAs } from "@/core/work";
import { Badge, Button, Card, Heading, Mono, RowButton, Text } from "@/components";
import { Banner, EmptyState } from "@/composites";
import { Divider, Row, Stack } from "@/frame";
import { AppShell } from "@/layouts";
import { Elsewhere, WipBar } from "@/pages/_shared";
import { useWork, waitingOn } from "@/pages/work/logic";
import { useText } from "@/lib/language";

/// Everything being watched, grouped by the boundary it belongs to.
///
/// The cockpit answers *what needs you*, and a project with nothing waiting
/// is correctly invisible there. This answers the other two questions: what
/// is being watched at all, and whose it is.
export function WorkPage({
  queue,
  onOpen,
  onOpenSettings,
  onOpenQueue,
}: {
  queue: Queue;
  onOpen: (project: string) => void;
  onOpenSettings: () => void;
  onOpenQueue: () => void;
}) {
  const t = useText();
  const { work, failed } = useWork();
  const now = Date.now();

  return (
    <AppShell
      title={t("Your work")}
      banner={<Elsewhere path={queue.elsewhere} />}
      aside={
        <Row gap="normal">
          <Button tone="ghost" size="sm" onClick={onOpenQueue}>
            {t("Needs you")}
            {queue.wip.sessions_waiting > 0 ? (
              <Badge tone="count">{queue.wip.sessions_waiting}</Badge>
            ) : null}
          </Button>
          <WipBar wip={queue.wip} />
          <Button tone="ghost" size="icon" onClick={onOpenSettings} aria-label={t("Settings")}>
            <GearSixIcon size={16} />
          </Button>
        </Row>
      }
    >
      {failed ? (
        <Banner label={t("Could not read the configuration")} tone="alarm">
          <Text as="span" size="sm" tone="alarm">
            {failed}
          </Text>
        </Banner>
      ) : !work ? (
        <Text tone="muted" size="sm">
          {t("Reading…")}
        </Text>
      ) : work.workspaces.length === 0 ? (
        <EmptyState
          headline={t("Nothing is being watched.")}
          detail={t(
            "A workspace holds the projects that share a confidentiality boundary. Make one, then register a project in it.",
          )}
          action={
            <Button tone="primary" onClick={onOpenSettings}>
              {t("Open settings")}
            </Button>
          }
        />
      ) : (
        <Stack gap="airy">
          {work.workspaces.map((g) => (
            <WorkspaceBlock
              key={g.workspace.id}
              group={g}
              queue={queue}
              now={now}
              onOpen={onOpen}
            />
          ))}

          {work.orphans.length > 0 ? (
            <Banner label={t("Belongs to no workspace")} tone="alarm">
              <Text as="span" size="sm" tone="alarm">
                {work.orphans.map((s) => s.project.id).join(", ")}
              </Text>
            </Banner>
          ) : null}
        </Stack>
      )}
    </AppShell>
  );
}

function WorkspaceBlock({
  group,
  queue,
  now,
  onOpen,
}: {
  group: Grouped;
  queue: Queue;
  now: number;
  onOpen: (project: string) => void;
}) {
  const t = useText();
  return (
    <Stack gap="snug">
      <Row gap="snug" align="baseline" justify="between">
        <Row gap="snug" align="baseline">
          <Heading level={2}>{group.workspace.id}</Heading>
          {/* The policy beside the name, because the workspace is where it
              lives and every project under it inherits exactly this. */}
          <Badge>{exportsAs(group.workspace, t)}</Badge>
        </Row>
        <Text as="span" size="sm" tone="faint">
          {group.projects.length === 0
            ? t("No projects")
            : t.plural(group.projects.length, "{n} project", "{n} projects")}
        </Text>
      </Row>

      {group.projects.length === 0 ? (
        <Text tone="muted" size="sm">
          {t("Nothing registered in this workspace yet.")}
        </Text>
      ) : (
        <Card>
          {group.projects.map((s, i) => (
            <Stack gap="none" key={s.project.id}>
              {i > 0 ? <Divider soft /> : null}
              <ProjectRow
                standing={s}
                waiting={waitingOn(queue, s.project.id)}
                now={now}
                onOpen={onOpen}
              />
            </Stack>
          ))}
        </Card>
      )}
    </Stack>
  );
}

function ProjectRow({
  standing,
  waiting,
  now,
  onOpen,
}: {
  standing: Standing;
  waiting: number;
  now: number;
  onOpen: (project: string) => void;
}) {
  const t = useText();
  const { project } = standing;
  return (
    <RowButton
      onClick={() => onOpen(project.id)}
      className="items-start gap-3 rounded-none px-4 py-3.5"
    >
      <Stack gap="tight" className="min-w-0 flex-1">
        <Row gap="snug" align="baseline">
          <Heading level={3} as="h3">
            {project.id}
          </Heading>
          {waiting > 0 ? <Badge tone="clay">{t("{n} waiting", { n: waiting })}</Badge> : null}
        </Row>
        <Mono className="break-all">{project.path}</Mono>
        <Text size="sm" tone={standing.unreachable ? "alarm" : "faint"}>
          {project.runtime === "this-machine" ? t("This machine") : project.runtime} ·{" "}
          {aliveness(standing, now, t)}
        </Text>
      </Stack>
      <ArrowRightIcon size={14} className="mt-1 shrink-0 text-ink-faint" />
    </RowButton>
  );
}
