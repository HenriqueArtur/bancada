import { useState } from "react";
import { Workbench } from "@/layouts";
import { FileTree } from "@/pages/files/tree";
import { CodeView } from "@/pages/files/code";

/// The tree, and whatever is selected in it.
export function FilesPage({ project }: { project: string }) {
  const [path, setPath] = useState<string | null>(null);
  return (
    <Workbench
      index={<FileTree project={project} onOpen={setPath} selected={path} />}
      subject={<CodeView project={project} path={path} />}
    />
  );
}
