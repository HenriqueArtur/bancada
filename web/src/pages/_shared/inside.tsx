import type { ReactNode } from "react";
import type { Queue } from "@/core/queue";
import type { Summary } from "@/core/review";
import type { Work } from "@/core/work";
import { Text } from "@/components";
import { Row } from "@/frame";
import { ProjectShell } from "@/layouts";
import { BackToQueue } from "@/pages/_shared/back";
import { Elsewhere } from "@/pages/_shared/elsewhere";
import { ProjectSwitcher } from "@/pages/_shared/switcher";
import { Tally } from "@/pages/_shared/tally";
import { WipBar } from "@/pages/_shared/wip";

export interface Inside {
  project: string;
  /// Which workspace the project belongs to, or `null` while the settings
  /// are still being read.
  ///
  /// Named on every screen because the workspace is the confidentiality
  /// boundary (ADR-003): which supervisor may read this work, and what it
  /// may let out, is decided by this word. A cockpit that shows you a diff
  /// without saying whose it is has left out the only thing that makes the
  /// answer safe.
  workspace: string | null;
  queue: Queue;
  onBack: () => void;
  tabs: ReactNode;
  /// The conversation panel, built once by the shell and shown on every
  /// screen inside the project.
  chat?: ReactNode;
  chatSide?: "left" | "right";
  /// Every project there is, for the switcher in the header. `null` while
  /// it is being read.
  work?: Work | null;
  onOpen: (project: string) => void;
  onMute: (project: string, muted: boolean) => void;
  /// How much has moved, for the strip along the bottom. `null` while it is
  /// still being counted — which is not the same as nothing having moved.
  summary?: Summary | null;
  /// Which harness this project's machine runs, and what it is pointed at.
  /// Absent until somebody says so in the settings.
  harness?: string | null;
  model?: string | null;
}

/// The chrome every screen inside a project wears, filled in.
///
/// One component so the four screens cannot each assemble it slightly
/// differently — which is exactly what happened when two of them built their
/// own bar and the controls moved as you changed tab.
export function InsideProject({
  project,
  workspace,
  queue,
  onBack,
  tabs,
  chat,
  chatSide,
  work,
  onOpen,
  onMute,
  summary,
  harness,
  model,
  measured,
  children,
}: Inside & { measured?: boolean; children: ReactNode }) {
  return (
    <ProjectShell
      back={<BackToQueue queue={queue} onBack={onBack} />}
      title={
        <ProjectSwitcher
          project={project}
          workspace={workspace}
          queue={queue}
          work={work ?? null}
          onOpen={onOpen}
          onMute={onMute}
        />
      }
      aside={
        <Row gap="normal" align="baseline">
          <Running harness={harness} model={model} />
          <WipBar wip={queue.wip} />
        </Row>
      }
      tabs={tabs}
      notice={<Elsewhere path={queue.elsewhere} />}
      chat={chat}
      chatSide={chatSide}
      footer={summary === undefined ? undefined : <Tally summary={summary} />}
      measured={measured}
    >
      {children}
    </ProjectShell>
  );
}

/// What is running this project, as you declared it.
///
/// Declared and not probed, so it is silent until somebody says. A header
/// that named the harness and guessed the model would be confidently right
/// about the half nobody was asking about.
function Running({ harness, model }: { harness?: string | null; model?: string | null }) {
  const said = [harness, model].filter(Boolean) as string[];
  if (said.length === 0) return null;

  return (
    <Row gap="tight" align="baseline" className="min-w-0">
      <Text as="span" size="sm" tone="muted" className="truncate">
        {said.join(" · ")}
      </Text>
    </Row>
  );
}
