import type { ReactNode } from "react";
import type { Queue } from "@/core/queue";
import { Text } from "@/components";
import { Row } from "@/frame";
import { ProjectShell } from "@/layouts";
import { BackToQueue, type Origin } from "@/pages/_shared/back";
import { Elsewhere } from "@/pages/_shared/elsewhere";
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
  from: Origin;
  onBack: () => void;
  tabs: ReactNode;
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
  from,
  onBack,
  tabs,
  measured,
  children,
}: Inside & { measured?: boolean; children: ReactNode }) {
  return (
    <ProjectShell
      back={<BackToQueue queue={queue} from={from} onBack={onBack} />}
      title={
        <Row gap="tight" align="baseline" className="min-w-0">
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
        </Row>
      }
      aside={<WipBar wip={queue.wip} />}
      tabs={tabs}
      notice={<Elsewhere path={queue.elsewhere} />}
      measured={measured}
    >
      {children}
    </ProjectShell>
  );
}
