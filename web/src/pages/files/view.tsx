import { useState } from "react";
import { Mono } from "@/components";
import { Row, Stack } from "@/frame";
import { Panes } from "@/layouts";
import { InsideProject, type Inside } from "@/pages/_shared";
import { useTracking } from "@/pages/files/logic";
import { FileTree } from "@/pages/files/tree";
import { CodeView } from "@/pages/files/code";

/// The tree, and whatever is selected in it.
///
/// Wears the same chrome as every other screen inside a project, and puts
/// the path of the open file on its own line under it. The path belongs to
/// this screen and not to the shell: no other tab has one, and a slot in the
/// shared bar that only one screen fills is a slot the others have to leave
/// a hole for.
export function FilesPage(inside: Inside) {
  const [path, setPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { worktree, paths } = useTracking(inside.project, query.trim() !== "");

  return (
    <InsideProject {...inside}>
      <Stack gap="none" className="min-h-0 flex-1">
        {path ? (
          <Row gap="snug" className="shrink-0 border-line-soft border-b bg-ground px-4 py-1.5">
            {/* Truncated from the left, because the end of a path is the
                part that identifies the file. */}
            <Mono className="truncate">{path}</Mono>
          </Row>
        ) : null}
        <Panes
          index={
            <FileTree
              project={inside.project}
              onOpen={setPath}
              selected={path}
              worktree={worktree}
              paths={paths}
              query={query}
              onQuery={setQuery}
            />
          }
          subject={<CodeView project={inside.project} path={path} />}
        />
      </Stack>
    </InsideProject>
  );
}
