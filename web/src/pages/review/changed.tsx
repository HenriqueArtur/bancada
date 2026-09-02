import { useState } from "react";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import type { FileDiff } from "@/core/review";
import { Button, Input, Popover, RowButton, Text } from "@/components";
import { Divider, Listing, ListingItem, Region, Row, Stack } from "@/frame";
import {
  type Filters,
  filtering,
  type Kind,
  kinds,
  leaf,
  type Node,
  NOTHING_FILTERED,
  sift,
  tree,
} from "@/pages/review/logic";
import { Churn, lookOf, nameOf, StatusIcon } from "@/pages/review/status";
import { cn } from "@/lib/cn";
import { useText } from "@/lib/language";

/// The changed files, as a tree that navigates rather than selects.
///
/// Clicking a row scrolls the page to that file; it does not replace what is
/// on screen. Every file is already down there, so there is nothing to come
/// back *from* — which is the whole reason this is not a two-pane selector,
/// and why the screen no longer needs a way out of one.
export function ChangedFiles({
  files,
  filters,
  onFilters,
  at,
  onGoTo,
}: {
  files: FileDiff[];
  filters: Filters;
  onFilters: (f: Filters) => void;
  /// The file the page is showing, so the tree can say where you are
  /// without you having put yourself there.
  at: string | null;
  onGoTo: (path: string) => void;
}) {
  const t = useText();
  const showing = sift(files, filters);
  const nodes = tree(showing);

  // Every directory open, and closing is what costs a click. A tree of
  // *changed* files is small and exists to be scanned; arriving to a column
  // of shut folders means opening all of them before the pane says anything.
  const [shut, setShut] = useState<Set<string>>(new Set());
  const fold = (path: string) =>
    setShut((s) => {
      const next = new Set(s);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  return (
    <Stack gap="snug">
      <Row gap="tight" align="center" className="px-1">
        <MagnifyingGlassIcon size={13} className="shrink-0 text-ink-faint" />
        <Input
          value={filters.query}
          onChange={(e) => onFilters({ ...filters, query: e.target.value })}
          placeholder={t("Filter by path")}
          aria-label={t("Filter by path")}
          className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
        />
        <FilterMenu files={files} filters={filters} onFilters={onFilters} />
      </Row>

      {showing.length === 0 ? (
        <Text tone="muted" size="sm" className="px-1 py-2">
          {files.length === 0 ? t("The tree matches its last commit.") : t("Nothing matches.")}
        </Text>
      ) : (
        <Region label={t("Changed files")} className="text-[13.5px]">
          <Level nodes={nodes} shut={shut} onFold={fold} at={at} onGoTo={onGoTo} top />
        </Region>
      )}
    </Stack>
  );
}

function Level({
  nodes,
  shut,
  onFold,
  at,
  onGoTo,
  top,
}: {
  nodes: Node[];
  shut: Set<string>;
  onFold: (path: string) => void;
  at: string | null;
  onGoTo: (path: string) => void;
  top?: boolean;
}) {
  return (
    <Listing indent={!top}>
      {nodes.map((n) =>
        n.kind === "dir" ? (
          <ListingItem key={n.path}>
            <RowButton onClick={() => onFold(n.path)} className="gap-1.5 text-ink-muted">
              {shut.has(n.path) ? <CaretRightIcon size={11} /> : <CaretDownIcon size={11} />}
              <Text as="span" size="sm" tone="muted" className="truncate" title={n.path}>
                {n.name}
              </Text>
            </RowButton>
            {shut.has(n.path) ? null : (
              <Level nodes={n.children} shut={shut} onFold={onFold} at={at} onGoTo={onGoTo} />
            )}
          </ListingItem>
        ) : (
          <ListingItem key={n.file.path}>
            <FileRow file={n.file} at={at === n.file.path} onGoTo={onGoTo} />
          </ListingItem>
        ),
      )}
    </Listing>
  );
}

function FileRow({
  file,
  at,
  onGoTo,
}: {
  file: FileDiff;
  at: boolean;
  onGoTo: (path: string) => void;
}) {
  const t = useText();
  const look = lookOf(file.status);

  return (
    <RowButton
      onClick={() => onGoTo(file.path)}
      selected={at}
      className="gap-1.5"
      title={file.from ? t("Renamed from {old}", { old: file.from }) : nameOf(file.status, t)}
    >
      <StatusIcon status={file.status} />
      <Text as="span" size="sm" className={cn("truncate", look.struck && "line-through")}>
        {leaf(file.path)}
      </Text>
      <Row gap="none" className="ml-auto">
        <Churn file={file} />
      </Row>
    </RowButton>
  );
}

/// One control for every way of showing less, the way GitHub has it.
///
/// A floating panel rather than a row of chips: three extensions and three
/// switches is more than a 248px column can hold beside a tree, and chips
/// that wrap to three lines push the tree below the fold.
function FilterMenu(props: {
  files: FileDiff[];
  filters: Filters;
  onFilters: (f: Filters) => void;
}) {
  const t = useText();
  const on = filtering(props.filters);

  return (
    <Popover
      label={t("Filter files")}
      align="end"
      className="w-60"
      trigger={
        <Button
          tone={on ? "outline" : "ghost"}
          size="sm"
          className={cn("shrink-0 px-1.5", on && "text-clay")}
          aria-label={t("Filter files")}
          title={t("Filter files")}
        >
          <FunnelSimpleIcon size={14} />
        </Button>
      }
    >
      <FilterPanel {...props} />
    </Popover>
  );
}

/// What is inside the menu, separately.
///
/// Exported apart from the popover it lives in because that is the seam
/// between what this file decides and what Radix does. Driving these ticks
/// through a portal, a focus scope and a floating-ui reflow tests Radix —
/// and under jsdom it also costs the suite about twelve seconds per spec
/// that opens one, on a gate that runs on every commit.
export function FilterPanel({
  files,
  filters,
  onFilters,
}: {
  files: FileDiff[];
  filters: Filters;
  onFilters: (f: Filters) => void;
}) {
  const t = useText();
  const present = kinds(files);
  const on = filtering(filters);

  const toggleExt = (ext: string) => {
    const now = filters.exts ?? present.map((k) => k.ext);
    const next = now.includes(ext) ? now.filter((e) => e !== ext) : [...now, ext];
    // Back to "every kind" rather than to an explicit list of all of them,
    // so a file of a new kind is never hidden by a filter nobody set.
    onFilters({ ...filters, exts: next.length === present.length ? null : next });
  };

  return (
    <Stack gap="none">
      {present.map((k) => (
        <Tick
          key={k.ext}
          on={filters.exts === null || filters.exts.includes(k.ext)}
          onPick={() => toggleExt(k.ext)}
          label={named(k, t)}
          n={k.n}
        />
      ))}
      <Divider soft />
      <Tick
        on={filters.hideViewed}
        onPick={() => onFilters({ ...filters, hideViewed: !filters.hideViewed })}
        label={t("Hide viewed")}
      />
      <Tick
        on={filters.hideDeleted}
        onPick={() => onFilters({ ...filters, hideDeleted: !filters.hideDeleted })}
        label={t("Hide deleted")}
      />
      {on ? (
        <>
          <Divider soft />
          {/* The search is left alone. It is a thing you are holding in your
              hand, not a filter you set and forgot, and wiping it from here
              would take back a word you just typed. */}
          <RowButton
            onClick={() => onFilters({ ...NOTHING_FILTERED, query: filters.query })}
            className="gap-2 px-2 py-1 text-[13px] text-clay"
          >
            {t("Clear filters")}
          </RowButton>
        </>
      ) : null}
    </Stack>
  );
}

function named(k: Kind, t: ReturnType<typeof useText>): string {
  if (k.ext === "dotfile") return t("Dotfiles");
  if (k.ext === "none") return t("No extension");
  return k.ext;
}

function Tick({
  on,
  onPick,
  label,
  n,
}: {
  on: boolean;
  onPick: () => void;
  label: string;
  n?: number;
}) {
  return (
    <RowButton onClick={onPick} aria-pressed={on} className="gap-2 px-2 py-1 text-[13px]">
      <Text as="span" size="sm" className={cn("w-3 shrink-0", on ? "text-clay" : "opacity-0")}>
        <CheckIcon size={12} weight="bold" />
      </Text>
      <Text as="span" size="sm" className="truncate">
        {label}
      </Text>
      {n === undefined ? null : (
        <Text as="span" size="sm" tone="faint" className="ml-auto shrink-0 tabular-nums">
          {n}
        </Text>
      )}
    </RowButton>
  );
}
