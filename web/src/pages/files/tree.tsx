import { useEffect, useState } from "react";
import { CaretDownIcon, CaretRightIcon, FileIcon } from "@phosphor-icons/react";
import type { Entry } from "@/core/review";
import { loadTree } from "@/core/review";
import { RowButton, Text } from "@/components";
import { Listing, ListingItem, Region } from "@/frame";

interface Props {
  project: string;
  onOpen: (path: string) => void;
  selected: string | null;
}

/// A directory at a time, expanded on demand.
///
/// Not a whole-tree walk: a repository with a `node_modules` in it hands
/// back a hundred thousand entries, and a pane that stalls on open has
/// stopped being part of a cockpit.
export function FileTree(props: Props) {
  return (
    <Region label="Project files" className="text-[13.5px]">
      <Level {...props} sub="" />
    </Region>
  );
}

function Level({ project, sub, onOpen, selected }: Props & { sub: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    loadTree(project, sub || undefined)
      .then((e) => alive && setEntries(e))
      .catch((e) => alive && setFailed(String(e)));
    return () => {
      alive = false;
    };
  }, [project, sub]);

  if (failed) {
    return (
      <Text tone="alarm" size="sm">
        {failed}
      </Text>
    );
  }
  if (!entries) {
    return (
      <Text tone="muted" size="sm">
        Reading…
      </Text>
    );
  }

  const toggle = (path: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <Listing indent={Boolean(sub)}>
      {entries.map((e) => (
        <ListingItem key={e.path}>
          {e.isDir ? (
            <>
              <RowButton onClick={() => toggle(e.path)} className="gap-1.5 text-ink-muted">
                {open.has(e.path) ? <CaretDownIcon size={11} /> : <CaretRightIcon size={11} />}
                {e.name}
              </RowButton>
              {open.has(e.path) ? (
                <Level project={project} sub={e.path} onOpen={onOpen} selected={selected} />
              ) : null}
            </>
          ) : (
            <RowButton
              onClick={() => onOpen(e.path)}
              selected={selected === e.path}
              className="gap-1.5"
            >
              <FileIcon size={11} className="shrink-0 opacity-50" />
              {e.name}
            </RowButton>
          )}
        </ListingItem>
      ))}
    </Listing>
  );
}
