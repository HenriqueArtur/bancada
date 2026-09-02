/// A page for looking at one screen without the product around it.
///
/// The window is a desktop app and this session is refused both screen
/// capture and accessibility, so the only way to see the interface is to
/// render it somewhere a command line can reach. It mounts the **real**
/// layout components — an imitation would only prove the imitation.
///
/// ```sh
/// bun run --cwd web dev --port 5199 &
/// tools/look.sh out.png "?light&plain"
/// ```
///
/// It has already earned itself three times: the editor was wearing Monaco's
/// stock primaries under mine, the brackets kept a rainbow the editor option
/// could not switch off, and a licence file was one line six hundred
/// characters long.
import { createRoot } from "react-dom/client";
import {
  ClockCounterClockwiseIcon,
  FolderOpenIcon,
  GitDiffIcon,
  QuotesIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "../src/theme.css";
import { Badge, Card, Heading, Mono, RowButton, Text } from "../src/components";
import { aliveness, exportsAs } from "../src/core/work";
import { Divider, Listing, ListingItem, Mount, Page, Row, Scroller, Stack } from "../src/frame";
import { Panes, ProjectShell } from "../src/layouts";
import { FileTree } from "../src/pages/files/tree";
import { CodeView } from "../src/pages/files/code";
import { Prose } from "../src/components";
import { prose } from "../src/core/prose";
import { apply as applyZoom } from "../src/core/zoom";
import { WorkspacesPanel } from "../src/pages/settings/workspaces";
import { ChangedFiles } from "../src/pages/review/changed";
import { FileSection } from "../src/pages/review/diff";
import { NOTHING_FILTERED, openOnArrival, sift, totals } from "../src/pages/review/logic";
import type { FileDiff } from "../src/core/review";
import { THEME, definition, paletteFor } from "../src/core/monaco-theme";

self.MonacoEnvironment = { getWorker: () => new editorWorker() };

const q = new URLSearchParams(location.search);
const dark = q.has("dark")
  ? true
  : q.has("light")
    ? false
    : matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", dark);

// `?zoom=2` renders a scene at that level, so the sticky headers and the
// scrolling panes can be looked at under it. `zoom` is a Chromium property
// with a history of arguing with `position: sticky`, and this product has
// three sticky headers on one screen.
const level = Number(q.get("zoom") ?? 0);
if (level !== 0) applyZoom(level);

// The bug this guards against does not show in a screenshot: the document
// gains a scrollbar and the header rides off the top only once somebody
// scrolls. Printed into the title so a headless render can read it.
if (q.has("measure")) {
  setTimeout(() => {
    const root = document.documentElement;
    const over = root.scrollHeight - root.clientHeight;
    document.title = `document overflows by ${over}px`;
  }, 500);
}

const LICENSE = `MIT License

Copyright (c) 2026 Henrique Artur

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
`;

const RUST = `use std::path::Path;

/// The queue for one project, from its facts.
#[derive(Debug, Clone)]
pub struct SessionState {
    pub session: SessionId,
    awaiting_human: bool,
}

impl SessionState {
    pub fn queue(states: &[Self], now: Timestamp, idle_after_ms: i64) -> Vec<QueueItem> {
        let mut out = Vec::new();
        for s in states {
            if s.awaiting_human && now.elapsed_to(s.last) > idle_after_ms {
                out.push(QueueItem::new(s.session.clone(), DecisionKind::Review, s.last));
            }
        }
        out // 42 items, "at most"
    }
}
`;

const plain = q.has("plain");

/// A second thing to look at: the work surface, with invented standing.
///
/// Its data comes from a command, so the probe hands it a fake rather than
/// mounting the page — the point is the shape of the screen, and a screen
/// that cannot render without a backend cannot be looked at at all.
function Work() {
  const workspaces = [
    {
      workspace: { id: "personal", export: "metadata" as const },
      projects: [
        {
          project: {
            id: "bancada",
            workspace: "personal",
            runtime: "this-machine",
            path: "/Users/henrique/Documents/dev/personal/bancada",
            weight: 1,
            idleAfterMinutes: 2,
          },
          sessions: 7,
          lastActivity: Date.now() - 4 * 60_000,
          unreachable: null,
        },
        {
          project: {
            id: "neo-gitmoji",
            workspace: "personal",
            runtime: "devbox",
            path: "/mnt/dev/neo-gitmoji.nvim",
            weight: 1,
            idleAfterMinutes: 2,
          },
          sessions: 0,
          lastActivity: null,
          unreachable: null,
        },
      ],
    },
    {
      workspace: { id: "client-x", export: "summary" as const },
      projects: [
        {
          project: {
            id: "api",
            workspace: "client-x",
            runtime: "devbox",
            path: "/mnt/dev/api",
            weight: 3,
            idleAfterMinutes: 2,
          },
          sessions: 3,
          lastActivity: Date.now() - 26 * 3_600_000,
          unreachable: null,
        },
      ],
    },
  ];
  const waiting: Record<string, number> = { bancada: 2 };
  const now = Date.now();
  return (
    <Page>
      <Stack gap="loose">
        <Row justify="between" align="end" className="border-b border-line-soft pb-4">
          <Heading level={1} as="h1">
            Your work
          </Heading>
          <Text as="span" size="sm" tone="muted">
            2 waiting
          </Text>
        </Row>
        <Stack gap="airy">
          {workspaces.map((g) => (
            <Stack gap="snug" key={g.workspace.id}>
              <Row gap="snug" align="baseline" justify="between">
                <Row gap="snug" align="baseline">
                  <Heading level={2}>{g.workspace.id}</Heading>
                  <Badge>{exportsAs(g.workspace)}</Badge>
                </Row>
                <Text as="span" size="sm" tone="faint">
                  {g.projects.length} project{g.projects.length === 1 ? "" : "s"}
                </Text>
              </Row>
              <Card>
                {g.projects.map((s, i) => (
                  <Stack gap="none" key={s.project.id}>
                    {i > 0 ? <Divider soft /> : null}
                    <RowButton className="items-start gap-3 rounded-none px-4 py-3.5">
                      <Stack gap="tight" className="min-w-0 flex-1">
                        <Row gap="snug" align="baseline">
                          <Heading level={3} as="h3">
                            {s.project.id}
                          </Heading>
                          {waiting[s.project.id] ? (
                            <Badge tone="clay">{waiting[s.project.id]} waiting</Badge>
                          ) : null}
                        </Row>
                        <Mono className="break-all">{s.project.path}</Mono>
                        <Text size="sm" tone="faint">
                          {s.project.runtime === "this-machine"
                            ? "This machine"
                            : s.project.runtime}
                          {" · "}
                          {aliveness(s, now)}
                        </Text>
                      </Stack>
                    </RowButton>
                  </Stack>
                ))}
              </Card>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Page>
  );
}

function Editor() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let editor: { dispose: () => void } | null = null;
    void import("monaco-editor/esm/vs/editor/editor.main").then((monaco) => {
      if (!host.current) return;
      monaco.editor.defineTheme(THEME, definition(paletteFor(dark)));
      editor = monaco.editor.create(host.current, {
        value: plain ? LICENSE : RUST,
        language: plain ? "plaintext" : "rust",
        readOnly: true,
        theme: THEME,
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 12, bottom: 12 },
        wordWrap: "on",
        wrappingIndent: "indent",
        bracketPairColorization: { enabled: false },
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        scrollbar: {
          verticalScrollbarSize: 11,
          horizontalScrollbarSize: 11,
          useShadows: false,
        },
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
      });
    });
    return () => editor?.dispose();
  }, []);
  return <Mount ref={host} />;
}

const FILES = [
  "Cargo.toml",
  "LICENSE-MIT",
  "README.md",
  "arch.config.json",
  "rust-toolchain.toml",
];

/// The settings dialog, with a configuration invented for it.
function Settings() {
  const [config, setConfig] = useState({
    workspaces: [
      { id: "personal", export: "metadata" as const },
      { id: "client-x", export: "summary" as const },
    ],
    runtimes: [],
    projects: [
      {
        id: "bancada",
        workspace: "personal",
        runtime: "this-machine",
        path: "/Users/henrique/Documents/dev/personal/bancada",
        weight: 1,
        idleAfterMinutes: 2,
      },
      {
        id: "neo-gitmoji",
        workspace: "personal",
        runtime: "devbox",
        path: "/mnt/dev/neo-gitmoji.nvim",
        weight: 1,
        idleAfterMinutes: 2,
      },
    ],
  });
  return (
    <Page>
      <Stack gap="loose">
        <Heading level={1} as="h1">
          Workspaces
        </Heading>
        <Text tone="muted" size="sm">
          Who each project belongs to, and what its supervisor may let out.
        </Text>
        <Divider soft />
        <WorkspacesPanel
          config={config}
          onRegister={(w, previous) =>
            setConfig((c) => ({
              ...c,
              workspaces: [...c.workspaces.filter((x) => x.id !== (previous ?? w.id)), w],
            }))
          }
          onForget={(id) =>
            setConfig((c) => ({ ...c, workspaces: c.workspaces.filter((w) => w.id !== id) }))
          }
          failed={null}
        />
      </Stack>
    </Page>
  );
}

/// A third thing to look at: the changes workbench, with an invented diff.
///
/// Every case that is easy to get wrong and impossible to see in the code:
/// the four statuses side by side, a joined directory chain, a hunk that
/// does not start at line one so the gap control appears, a file already
/// viewed arriving folded, and a rewritten line whose changed words have to
/// read against the wash they sit on rather than against the page.
const HUNKS = [
  {
    header: "@@ -29,7 +29,15 @@ pub struct FileDiff {",
    oldStart: 29,
    oldLines: 7,
    newStart: 29,
    newLines: 15,
    lines: [
      { kind: "context", text: "#[derive(Debug, Clone, PartialEq, Eq, Serialize)]" },
      { kind: "added", text: '#[serde(rename_all = "camelCase")]' },
      { kind: "context", text: "pub struct Hunk {" },
      { kind: "removed", text: "    pub lines: Vec<Line>," },
      { kind: "added", text: "    pub old_start: usize," },
      { kind: "added", text: "    pub lines: Vec<Line>," },
      { kind: "context", text: "}" },
    ],
  },
  {
    header: "@@ -88,4 +96,4 @@ impl Diff {",
    oldStart: 88,
    oldLines: 4,
    newStart: 96,
    newLines: 4,
    lines: [
      { kind: "context", text: '            if line.starts_with("@@") {' },
      { kind: "removed", text: "                let count = old_lines_only(line);" },
      { kind: "added", text: "                let count = both_spans_of(line);" },
      { kind: "context", text: "                file.hunks.push(Hunk {" },
    ],
  },
] as FileDiff["hunks"];

const CHANGED: FileDiff[] = [
  {
    path: "crates/bancada-core/src/diff.rs",
    added: 31,
    removed: 4,
    status: "modified",
    from: null,
    fingerprint: "a",
    fresh: true,
    hunks: HUNKS,
  },
  {
    path: "web/src/pages/review/status.tsx",
    added: 48,
    removed: 0,
    status: "added",
    from: null,
    fingerprint: "b",
    fresh: true,
    hunks: [HUNKS[1]],
  },
  {
    path: "web/src/pages/review/intent.tsx",
    added: 0,
    removed: 39,
    status: "deleted",
    from: null,
    fingerprint: "c",
    fresh: true,
    hunks: [],
  },
  {
    path: "web/src/pages/said/panel.tsx",
    added: 2,
    removed: 2,
    status: "renamed",
    from: "web/src/pages/review/intent.tsx",
    fingerprint: "d",
    fresh: false,
    hunks: [HUNKS[1]],
  },
  {
    path: "README.md",
    added: 4,
    removed: 1,
    status: "modified",
    from: null,
    fingerprint: "e",
    fresh: false,
    hunks: [HUNKS[1]],
  },
];

function Changes() {
  const [filters, setFilters] = useState(NOTHING_FILTERED);
  const [at, setAt] = useState<string | null>(CHANGED[0].path);
  const showing = sift(CHANGED, UNANNOUNCED, filters);
  const sum = totals(showing, UNANNOUNCED);
  const unfolded = openOnArrival(showing);

  return (
    <ProjectShell
      back={
        <Text as="span" size="sm" tone="muted">
          ← Needs you
        </Text>
      }
      title={
        <Row gap="tight" align="baseline">
          <Text as="span" className="font-medium">
            bancada
          </Text>
          <Text as="span" size="sm" tone="faint">
            ·
          </Text>
          <Text as="span" size="sm" tone="muted">
            personal
          </Text>
        </Row>
      }
      aside={
        <Text as="span" size="sm" tone="faint">
          2 waiting
        </Text>
      }
      tabs={
        <Row gap="tight">
          {(
            [
              ["What they said", QuotesIcon],
              ["Files changed", GitDiffIcon],
              ["Files", FolderOpenIcon],
              ["History", ClockCounterClockwiseIcon],
            ] as const
          ).map(([n, Glyph]) => (
            <Row
              key={n}
              gap="tight"
              className={
                n === "Files changed"
                  ? "rounded-lg border border-line bg-raised px-2.5 py-1"
                  : "px-2.5 py-1 text-ink-muted"
              }
            >
              <Glyph size={13} />
              <Text as="span" size="sm" className="text-inherit">
                {n}
              </Text>
            </Row>
          ))}
        </Row>
      }
    >
      <Panes
        index={
          <ChangedFiles
            files={CHANGED}
            unannounced={UNANNOUNCED}
            filters={filters}
            onFilters={setFilters}
            at={at}
            onGoTo={setAt}
          />
        }
        subject={
          <Stack gap="none" className="min-h-0 flex-1">
            <Row
              gap="snug"
              align="baseline"
              className="shrink-0 border-line border-b bg-ground px-4 py-2.5"
            >
              <Text as="span" size="sm">
                {sum.files} changed files
              </Text>
              <Text as="span" size="sm" className="text-sage tabular-nums">
                +{sum.added}
              </Text>
              <Text as="span" size="sm" className="text-alarm tabular-nums">
                −{sum.removed}
              </Text>
              <Text as="span" size="sm" tone="alarm">
                ▲ {sum.unannounced} unannounced
              </Text>
            </Row>
            <Scroller className="min-h-0 flex-1">
              <Stack gap="snug" className="p-3">
                {showing.map((f) => (
                  <FileSection
                    key={f.path}
                    project="bancada"
                    file={f}
                    unannounced={UNANNOUNCED.includes(f.path)}
                    startOpen={unfolded.has(f.path)}
                    onVouch={() => {}}
                    onEnter={setAt}
                  />
                ))}
              </Stack>
            </Scroller>
          </Stack>
        }
      />
    </ProjectShell>
  );
}

const UNANNOUNCED = ["crates/bancada-core/src/diff.rs"];

/// A fourth thing to look at: the file pane before anything is open, and the
/// tree coloured by what git says. Both are cases the code cannot show.
const TRACKED = {
  files: {
    "web/src/app.tsx": "modified" as const,
    "web/src/core/prose.ts": "untracked" as const,
    "README.md": "modified" as const,
  },
  dirs: { target: "ignored" as const, "web/node_modules": "ignored" as const },
};

function Files() {
  const [query, setQuery] = useState("");
  return (
    <ProjectShell
      back={
        <Text as="span" size="sm" tone="muted">
          ← Needs you
        </Text>
      }
      title={
        <Row gap="tight" align="baseline">
          <Text as="span" className="font-medium">
            bancada
          </Text>
          <Text as="span" size="sm" tone="faint">
            ·
          </Text>
          <Text as="span" size="sm" tone="muted">
            personal
          </Text>
        </Row>
      }
      tabs={
        <Row gap="tight">
          {(
            [
              ["What they said", QuotesIcon],
              ["Files changed", GitDiffIcon],
              ["Files", FolderOpenIcon],
              ["History", ClockCounterClockwiseIcon],
            ] as const
          ).map(([n, Glyph]) => (
            <Row
              key={n}
              gap="tight"
              className={
                n === "Files"
                  ? "rounded-lg border border-line bg-raised px-2.5 py-1"
                  : "px-2.5 py-1 text-ink-muted"
              }
            >
              <Glyph size={13} />
              <Text as="span" size="sm" className="text-inherit">
                {n}
              </Text>
            </Row>
          ))}
        </Row>
      }
    >
      <Panes
        index={
          <FileTree
            project="bancada"
            onOpen={() => {}}
            selected={null}
            worktree={TRACKED}
            paths={null}
            query={query}
            onQuery={setQuery}
          />
        }
        subject={<CodeView project="bancada" path={null} />}
      />
    </ProjectShell>
  );
}

/// And the commit message, which came out as one ragged blob before it was
/// parsed. Every construct a commit here actually uses, in one string.
const MESSAGE = `The application had no mark of its own and wore the Tauri
default, and in the menu bar it introduced itself as \`bancada\` — the slug,
not the noun.

Both are the **same mistake**: the identifiers leaked into the places meant
for a person to read.

- three shapes leaning on a bench, because one is a logo for a thing
  that does one thing at a time
- not four, because at 32px the fourth is a smudge

Run it with:

\`\`\`sh
make check
\`\`\`

> A summary of a claim is a second claim.`;

function Message() {
  return (
    <Page>
      <Stack gap="normal">
        <Heading level={1} as="h1">
          🎨 | a face, and a name that is a name
        </Heading>
        <Divider soft />
        <Prose blocks={prose(MESSAGE)} className="max-w-[68ch]" />
      </Stack>
    </Page>
  );
}

createRoot(document.getElementById("root")!).render(
  q.has("settings") ? (
    <Settings />
  ) : q.has("work") ? (
    <Work />
  ) : q.has("changes") ? (
    <Changes />
  ) : q.has("files") ? (
    <Files />
  ) : q.has("message") ? (
    <Message />
  ) : (
    <Workbench
      bar={
        <>
          <Row gap="snug" align="baseline">
            <Text as="span" size="sm" tone="muted">
              bancada
            </Text>
            <Mono>/ {plain ? "LICENSE-MIT" : "crates/bancada-rules/src/session_state.rs"}</Mono>
          </Row>
          <Text as="span" size="sm" tone="faint">
            probe
          </Text>
        </>
      }
      index={
        <Listing>
          {FILES.map((f) => (
            <ListingItem key={f}>
              <RowButton selected={plain ? f === "LICENSE-MIT" : false} className="gap-1.5">
                {f}
              </RowButton>
            </ListingItem>
          ))}
        </Listing>
      }
      subject={<Editor />}
    />
  ),
);
