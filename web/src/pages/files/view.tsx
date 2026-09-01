import { useState } from "react";
import type { Queue } from "@/core/queue";
import { Mono, Text } from "@/components";
import { Row } from "@/frame";
import { Workbench } from "@/layouts";
import { BackToQueue } from "@/pages/_shared";
import { FileTree } from "@/pages/files/tree";
import { CodeView } from "@/pages/files/code";

/// The tree, and whatever is selected in it.
///
/// Owns its own shell rather than sitting inside the measured one. This is
/// the screen you came to read a file on, and every pixel spent on margin is
/// a character of the file you cannot see.
export function FilesPage({
  project,
  queue,
  onBack,
  tabs,
}: {
  project: string;
  queue: Queue;
  onBack: () => void;
  tabs: React.ReactNode;
}) {
  const [path, setPath] = useState<string | null>(null);

  return (
    <Workbench
      bar={
        <>
          <Row gap="snug" align="baseline" className="min-w-0">
            <BackToQueue queue={queue} onBack={onBack} />
            <Text as="span" size="sm" tone="muted">
              {project}
            </Text>
            {/* Where you are, the way an editor says it. Truncated from the
                left, because the end of a path is the part that identifies
                the file. */}
            {path ? <Mono className="truncate">/ {path}</Mono> : null}
          </Row>
          {tabs}
        </>
      }
      index={<FileTree project={project} onOpen={setPath} selected={path} />}
      subject={<CodeView project={project} path={path} />}
    />
  );
}
