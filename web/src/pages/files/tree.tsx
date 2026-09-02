import { useEffect, useState } from "react";
import {
  CaretDownIcon,
  CaretRightIcon,
  FileIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import type { Entry, Worktree } from "@/core/review";
import { loadTree } from "@/core/review";
import { Input, RowButton, Text } from "@/components";
import { Listing, ListingItem, Region, Row, Stack } from "@/frame";
import { leafOf, search, trackOf, trackUnder } from "@/pages/files/logic";
import { nameOfTrack, toneOf, TrackMark } from "@/pages/files/track";
import { cn } from "@/lib/cn";
import { useText } from "@/lib/language";

interface Props {
  project: string;
  onOpen: (path: string) => void;
  selected: string | null;
}

/// A directory at a time, expanded on demand — or a flat list of hits while
/// you are searching.
///
/// Not a whole-tree walk: a repository with a `node_modules` in it hands
/// back a hundred thousand entries, and a pane that stalls on open has
/// stopped being part of a cockpit. Searching is the exception, and it pays
/// for the walk only once somebody asks a question.
export function FileTree({
  project,
  onOpen,
  selected,
  worktree,
  paths,
  query,
  onQuery,
}: Props & {
  worktree: Worktree;
  paths: string[] | null;
  query: string;
  onQuery: (q: string) => void;
}) {
  const t = useText();
  const hits = paths === null ? [] : search(paths, query);
  const searching = query.trim() !== "";

  return (
    <Stack gap="snug">
      <Row gap="tight" align="center" className="px-1">
        <MagnifyingGlassIcon size={13} className="shrink-0 text-ink-faint" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("Find a file by path")}
          aria-label={t("Find a file by path")}
          className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
        />
      </Row>

      <Region label={t("Project files")} className="text-[13.5px]">
        {searching ? (
          paths === null ? (
            <Text tone="muted" size="sm" className="px-1 py-2">
              {t("Reading the tree…")}
            </Text>
          ) : hits.length === 0 ? (
            <Text tone="muted" size="sm" className="px-1 py-2">
              {t("No file matches.")}
            </Text>
          ) : (
            <Listing>
              {hits.map((path) => (
                <ListingItem key={path}>
                  <Hit
                    path={path}
                    worktree={worktree}
                    selected={selected === path}
                    onOpen={onOpen}
                  />
                </ListingItem>
              ))}
            </Listing>
          )
        ) : (
          <Level
            project={project}
            sub=""
            onOpen={onOpen}
            selected={selected}
            worktree={worktree}
          />
        )}
      </Region>
    </Stack>
  );
}

/// A search hit: the name, then where it lives. That order because the name
/// is what you typed and the directory is how you tell two of them apart.
function Hit({
  path,
  worktree,
  selected,
  onOpen,
}: {
  path: string;
  worktree: Worktree;
  selected: boolean;
  onOpen: (path: string) => void;
}) {
  const t = useText();
  const track = trackOf(worktree, path);
  const cut = path.lastIndexOf("/");

  return (
    <RowButton onClick={() => onOpen(path)} selected={selected} className="gap-1.5">
      <FileIcon size={11} className="shrink-0 opacity-50" />
      <Text as="span" size="sm" className={cn("shrink-0", toneOf(track))}>
        {leafOf(path)}
      </Text>
      {cut === -1 ? null : (
        <Text as="span" size="sm" tone="faint" className="truncate" title={path}>
          {path.slice(0, cut)}
        </Text>
      )}
      {track ? <TrackMark track={track} title={nameOfTrack(track, t)} /> : null}
    </RowButton>
  );
}

function Level({
  project,
  sub,
  onOpen,
  selected,
  worktree,
}: Props & { sub: string; worktree: Worktree }) {
  const t = useText();
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
        {t("Reading…")}
      </Text>
    );
  }

  const toggle = (path: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <Listing indent={Boolean(sub)}>
      {entries.map((e) => (
        <ListingItem key={e.path}>
          {e.isDir ? (
            <>
              <Folder
                entry={e}
                worktree={worktree}
                open={open.has(e.path)}
                onToggle={() => toggle(e.path)}
              />
              {open.has(e.path) ? (
                <Level
                  project={project}
                  sub={e.path}
                  onOpen={onOpen}
                  selected={selected}
                  worktree={worktree}
                />
              ) : null}
            </>
          ) : (
            <Leaf
              entry={e}
              worktree={worktree}
              selected={selected === e.path}
              onOpen={onOpen}
            />
          )}
        </ListingItem>
      ))}
    </Listing>
  );
}

/// A directory, coloured by what changed inside it.
///
/// A closed folder that says nothing is a folder you have to open to learn
/// anything, which is most of the reason to colour a tree at all.
function Folder({
  entry,
  worktree,
  open,
  onToggle,
}: {
  entry: Entry;
  worktree: Worktree;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useText();
  const track = trackUnder(worktree, entry.path);

  return (
    <RowButton
      onClick={onToggle}
      className={cn("gap-1.5", track === "ignored" ? "text-ink-faint" : "text-ink-muted")}
    >
      {open ? <CaretDownIcon size={11} /> : <CaretRightIcon size={11} />}
      <Text as="span" size="sm" className={cn("truncate", toneOf(track))}>
        {entry.name}
      </Text>
      {track ? <TrackMark track={track} title={nameOfTrack(track, t)} /> : null}
    </RowButton>
  );
}

function Leaf({
  entry,
  worktree,
  selected,
  onOpen,
}: {
  entry: Entry;
  worktree: Worktree;
  selected: boolean;
  onOpen: (path: string) => void;
}) {
  const t = useText();
  const track = trackOf(worktree, entry.path);

  return (
    <RowButton onClick={() => onOpen(entry.path)} selected={selected} className="gap-1.5">
      <FileIcon
        size={11}
        className={cn("shrink-0", track === "ignored" ? "opacity-30" : "opacity-50")}
      />
      <Text as="span" size="sm" className={cn("truncate", toneOf(track))}>
        {entry.name}
      </Text>
      {track ? <TrackMark track={track} title={nameOfTrack(track, t)} /> : null}
    </RowButton>
  );
}
