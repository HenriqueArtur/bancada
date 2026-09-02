import { useState } from "react";
import { ArrowRightIcon, GearSixIcon, PlusIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import type { Config, Project, Workspace } from "@/core/settings";
import type { Grouped, Standing, Work } from "@/core/work";
import { aliveness, exportsAs } from "@/core/work";
import { Badge, Button, Card, Heading, Mono, RowButton, Text, Toggle } from "@/components";
import { Banner, EmptyState } from "@/composites";
import { Divider, Row, Stack } from "@/frame";
import { AppShell } from "@/layouts";
import { Elsewhere, WipBar } from "@/pages/_shared";
import { useSettings } from "@/pages/settings/logic";
import { ProjectForm } from "@/pages/settings/projects";
import { WorkspaceForm } from "@/pages/settings/workspaces";
import { waitingOn } from "@/pages/work/logic";
import { useText } from "@/lib/language";

/// Everything being watched, grouped by the boundary it belongs to.
///
/// The cockpit answers *what needs you*, and a project with nothing waiting
/// is correctly invisible there. This answers the other two questions: what
/// is being watched at all, and whose it is.
export function WorkPage({
  queue,
  work,
  failed,
  onReload,
  onOpen,
  onMute,
  onOpenSettings,
  onOpenQueue,
}: {
  queue: Queue;
  /// Read by the shell, because the switcher in every project header lists
  /// the same projects. Two readings of "which projects exist" is two
  /// answers to the question the whole product is about.
  work: Work | null;
  failed: string | null;
  onReload: () => void;
  onOpen: (project: string) => void;
  onMute: (project: string, muted: boolean) => void;
  onOpenSettings: () => void;
  onOpenQueue: () => void;
}) {
  const t = useText();
  // The same hook the settings dialog uses, so a project registered from
  // here goes through exactly the validation and the labels it would there.
  // Adding one is the reason you came to this screen; making you find
  // another screen to do it is the thing being fixed.
  const { config, register, addWorkspace } = useSettings(onReload);
  const [adding, setAdding] = useState<string | null>(null);
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
              config={config}
              adding={adding === g.workspace.id}
              onAdd={() => setAdding(adding === g.workspace.id ? null : g.workspace.id)}
              onRegister={(p) => {
                register(p);
                setAdding(null);
              }}
              onOpen={onOpen}
              onMute={onMute}
            />
          ))}

          <NewWorkspace config={config} onAdd={addWorkspace} />

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

/// The boundary itself, made from this screen.
///
/// Its own component so the page above stays about arranging what exists;
/// folded away until asked for, because most people make a workspace a
/// handful of times ever and an open form makes the rare case look common.
function NewWorkspace({
  config,
  onAdd,
}: {
  config: Config | null;
  onAdd: (w: Workspace) => void;
}) {
  const t = useText();
  const [open, setOpen] = useState(false);

  if (open && config) {
    return (
      <WorkspaceForm
        config={config}
        editing={null}
        onCancel={() => setOpen(false)}
        onSubmit={(w) => {
          onAdd(w);
          setOpen(false);
        }}
      />
    );
  }
  return (
    <Row gap="none">
      <Button tone="ghost" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon size={13} />
        {t("New workspace")}
      </Button>
    </Row>
  );
}

function WorkspaceBlock({
  group,
  queue,
  now,
  config,
  adding,
  onAdd,
  onRegister,
  onOpen,
  onMute,
}: {
  group: Grouped;
  queue: Queue;
  now: number;
  config: Config | null;
  adding: boolean;
  onAdd: () => void;
  onRegister: (p: Project) => void;
  onOpen: (project: string) => void;
  onMute: (project: string, muted: boolean) => void;
}) {
  const t = useText();
  const silenced = group.projects.filter((s) => !s.asking).length;
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
            : silenced > 0
              ? // Both numbers, whenever anything is silenced. "2 projects"
                // and "2 projects, one of which was told not to ask" are
                // different facts about the same list.
                t("{asking} active · {silenced} silenced", {
                  asking: group.projects.length - silenced,
                  silenced,
                })
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
                onMute={onMute}
              />
            </Stack>
          ))}
        </Card>
      )}

      {adding && config ? (
        <ProjectForm
          config={config}
          editing={null}
          into={group.workspace.id}
          onCancel={onAdd}
          onSubmit={onRegister}
        />
      ) : (
        <Row gap="none">
          <Button tone="ghost" size="sm" onClick={onAdd}>
            <PlusIcon size={13} />
            {t("Add a project in {workspace}", { workspace: group.workspace.id })}
          </Button>
        </Row>
      )}
    </Stack>
  );
}

function ProjectRow({
  standing,
  waiting,
  now,
  onOpen,
  onMute,
}: {
  standing: Standing;
  waiting: number;
  now: number;
  onOpen: (project: string) => void;
  onMute: (project: string, muted: boolean) => void;
}) {
  const t = useText();
  const { project } = standing;
  return (
    // The switch sits beside the row rather than inside it: a button inside
    // a button is not a thing the platform can dispatch, and the whole row
    // has been the way to open a project since there was a row.
    <Row gap="none" align="start" className="min-w-0">
      <RowButton
        onClick={() => onOpen(project.id)}
        className="min-w-0 flex-1 items-start gap-3 rounded-none px-4 py-3.5"
      >
        <Stack gap="tight" className="min-w-0 flex-1">
          <Row gap="snug" align="baseline" wrap>
            {/* Faint when it is silenced. An empty checkbox at the far edge
                was the only thing saying so, which made a silenced project
                and a working one read identically down the whole row. */}
            <Heading
              level={3}
              as="h3"
              className={standing.asking ? undefined : "text-ink-faint"}
            >
              {project.id}
            </Heading>
            {standing.asking ? null : <Badge>{t("Silenced")}</Badge>}
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
      <Toggle
        on={standing.asking}
        onChange={(on) => onMute(project.id, !on)}
        label=""
        hint={
          standing.asking
            ? t("Stop {project} asking until there is new work in it", { project: project.id })
            : t("Let {project} ask again", { project: project.id })
        }
        // On the name's line, not the row's middle. Centred against three
        // lines of text it sat beside the path and read as belonging to it.
        className="mt-3.5 shrink-0 px-4"
      />
    </Row>
  );
}
