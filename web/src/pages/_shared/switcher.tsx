import { CaretUpDownIcon } from "@phosphor-icons/react";
import type { Queue } from "@/core/queue";
import type { Work } from "@/core/work";
import { waitingOn } from "@/pages/work/logic";
import { Badge, Button, Popover, RowButton, Text, Toggle } from "@/components";
import { Divider, Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

/// The projects to choose between, without the popover around them.
///
/// Split out because opening a Radix portal in a test costs about seven
/// seconds, and the wiring tests through the trigger were paying a hundred
/// and fifty for what this asserts directly. The third time this trade has
/// been made here; the first two were the diff filter and the session
/// picker.
export function ProjectList({
  project,
  queue,
  work,
  onOpen,
  onMute,
}: {
  project: string;
  queue: Queue;
  work: Work | null;
  onOpen: (project: string) => void;
  onMute: (project: string, muted: boolean) => void;
}) {
  const t = useText();

  return (
    <Stack gap="none">
      <Row gap="none" className="px-2 pt-1 pb-2">
        <Text as="span" size="sm" tone="faint">
          {t("{asking} active · {silenced} silenced", {
            asking: queue.asking,
            silenced: queue.silenced,
          })}
        </Text>
      </Row>

      {work === null ? (
        <Row gap="none" className="px-2 py-2">
          <Text as="span" size="sm" tone="muted">
            {t("Reading the projects…")}
          </Text>
        </Row>
      ) : (
        work.workspaces
          // A workspace with nothing in it is a row that offers nothing to
          // switch to. It belongs on the screen that manages workspaces.
          .filter((g) => g.projects.length > 0)
          .map((g, i) => (
            <Stack gap="none" key={g.workspace.id}>
              {i > 0 ? <Divider soft /> : null}
              <Row gap="none" className="px-2 pt-2 pb-1">
                <Text
                  as="span"
                  size="sm"
                  tone="faint"
                  className="font-medium text-[11px] uppercase tracking-[0.08em]"
                >
                  {g.workspace.id}
                </Text>
              </Row>
              {g.projects.map((s) => {
                const waiting = waitingOn(queue, s.project.id);
                return (
                  <Row gap="tight" key={s.project.id} className="min-w-0">
                    <RowButton
                      onClick={() => onOpen(s.project.id)}
                      selected={s.project.id === project}
                      className="min-w-0 flex-1 gap-2 px-2 py-1.5"
                    >
                      <Text
                        as="span"
                        size="sm"
                        tone={s.asking ? undefined : "faint"}
                        className="min-w-0 flex-1 truncate"
                      >
                        {s.project.id}
                      </Text>
                      {waiting > 0 ? <Badge tone="count">{waiting}</Badge> : null}
                    </RowButton>
                    {/* The switch is here rather than only on the screens
                        that list projects: this is where you are looking
                        when you notice a project has stopped being yours to
                        worry about. */}
                    <Toggle
                      on={s.asking}
                      onChange={(on) => onMute(s.project.id, !on)}
                      label=""
                      hint={
                        s.asking
                          ? t("Silence {project}", { project: s.project.id })
                          : t("Let {project} ask again", { project: s.project.id })
                      }
                      className="shrink-0 px-1.5"
                    />
                  </Row>
                );
              })}
            </Stack>
          ))
      )}
    </Stack>
  );
}

/// The project you are in, and every other one you could be in.
///
/// The name in the header was a label. It is the one word on screen you are
/// most likely to want to change, and changing it meant going back to the
/// queue, finding the other project and opening it — three moves to do the
/// thing the header was already naming.
///
/// Grouped by workspace because that is the confidentiality boundary
/// (ADR-003), and because switching *across* one is a different act from
/// switching within it. The screen comes with you: from one project's diff
/// to another's, not back to the top.
export function ProjectSwitcher({
  project,
  workspace,
  queue,
  work,
  onOpen,
  onMute,
}: {
  project: string;
  workspace: string | null;
  queue: Queue;
  work: Work | null;
  onOpen: (project: string) => void;
  onMute: (project: string, muted: boolean) => void;
}) {
  const t = useText();

  return (
    <Popover
      label={t("Which project")}
      align="start"
      className="w-[22rem]"
      trigger={
        <Button tone="ghost" size="sm" className="-ml-1.5 min-w-0 gap-1.5 px-1.5">
          <Text as="span" className="truncate font-medium">
            {project}
          </Text>
          {workspace ? (
            <>
              <Text as="span" size="sm" tone="faint" className="shrink-0">
                ·
              </Text>
              {/* Muted, not faint. This is the confidentiality boundary, and
                  a word set so light it reads as decoration is a word nobody
                  checks before trusting what is on the screen. */}
              <Text as="span" size="sm" tone="muted" className="shrink-0">
                {workspace}
              </Text>
            </>
          ) : null}
          <CaretUpDownIcon size={12} className="shrink-0 opacity-60" />
        </Button>
      }
    >
      <ProjectList
        project={project}
        queue={queue}
        work={work}
        onOpen={onOpen}
        onMute={onMute}
      />
    </Popover>
  );
}
