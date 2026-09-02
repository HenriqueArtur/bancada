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
  ChatCircleTextIcon,
  ClockCounterClockwiseIcon,
  FolderOpenIcon,
  GitDiffIcon,
  QuotesIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "../src/theme.css";
import { Card, Heading, Mono, RowButton, Text } from "../src/components";
import {
  Divider,
  Inset,
  Listing,
  ListingItem,
  Mount,
  Page,
  Row,
  Scroller,
  Stack,
} from "../src/frame";
import { Panes, ProjectShell } from "../src/layouts";
import { FileTree } from "../src/pages/files/tree";
import { CodeView } from "../src/pages/files/code";
import { Prose } from "../src/components";
import { prose } from "../src/core/prose";
import { SessionCard } from "../src/pages/sessions/card";
import { ChatPanel } from "../src/pages/sessions/panel";
import { SessionIndex } from "../src/pages/sessions/view";
import { Tally } from "../src/pages/_shared/tally";
import { EmptyState } from "../src/composites";
import { WorkPage } from "../src/pages/work/view";
import { ProjectList } from "../src/pages/_shared/switcher";
import { KeysPanel } from "../src/pages/settings/keys";
import { SidePanel } from "../src/pages/settings/side";
import { DEFAULTS } from "../src/core/shortcuts";
import { apply as applyZoom } from "../src/core/zoom";
import { WorkspacesPanel } from "../src/pages/settings/workspaces";
import { ChangedFiles } from "../src/pages/review/changed";
import { FileSection } from "../src/pages/review/diff";
import { NOTHING_FILTERED, openOnArrival, sift, totals } from "../src/pages/review/logic";
import type { FileDiff } from "../src/core/review";
import { THEME, definition, paletteFor } from "../src/core/monaco-theme";

self.MonacoEnvironment = { getWorker: () => new editorWorker() };

// The seam, answered from fixtures.
//
// `invoke` reads this and nothing else, so stubbing it lets the *real*
// components render — the panel's own paging, error handling and chrome,
// rather than a copy of them that could drift from what ships. Everything
// else in this file mounts real components for the same reason.
const OVER_THE_SEAM: Record<string, (args: Record<string, unknown>) => unknown> = {
  chat: ({ skip }) => ({
    said: (skip as number) > 0 ? [] : TALK,
    more: (skip as number) === 0,
  }),
  summary: () => ({ files: 14, added: 1204, removed: 317 }),
  // The work screen registers projects through the same form the settings
  // dialog uses, and that form asks the configuration what machines and
  // workspaces there are.
  settings: () => ({
    workspaces: [{ id: "personal" }, { id: "client-x", export: "summary" }],
    runtimes: [
      {
        id: "this-machine",
        kind: "local",
        prefix: [],
        hostRoot: "/",
        guestRoot: "/",
        configDir: "/Users/h/.claude",
        sharedFs: true,
        harness: "claude-code",
        model: "claude-opus-5",
      },
      {
        id: "devbox",
        kind: "vm",
        prefix: ["limactl", "shell", "devbox", "--"],
        hostRoot: "/Users/henrique/Documents/dev/personal",
        guestRoot: "/mnt/dev",
        configDir: "/Users/h/.devbox",
        sharedFs: true,
        harness: null,
        model: null,
      },
    ],
    projects: [],
  }),
};
(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
  invoke: async (cmd: string, args: Record<string, unknown>) =>
    OVER_THE_SEAM[cmd]?.(args ?? {}) ?? null,
};

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
// `?expand` opens every disclosure on the page once it has mounted.
//
// A screenshot cannot click, and the two things worth looking at here are
// both behind one — a run of tool calls, and a folded diff. The probe
// clicking its own DOM is honest; drawing an imitation of the open state
// would only prove the imitation.
if (q.has("expand")) {
  setTimeout(() => {
    // Not Radix's own triggers: a popover opened over the thing being
    // looked at is a picture of the popover.
    for (const b of document.querySelectorAll('[aria-expanded="false"]:not([data-state])')) {
      (b as HTMLElement).click();
    }
  }, 600);
}

if (q.has("measure")) {
  setTimeout(() => {
    const root = document.documentElement;
    const over = root.scrollHeight - root.clientHeight;
    document.title = `document overflows by ${over}px`;
  }, 500);
}

/// A conversation with the three shapes in it: your words, its prose, and a
/// question it is stopped on. What has to be looked at is that the three read
/// as one thread — nobody is named, and the sides carry that on their own.
const NOW = Date.now();
const TALK = [
  {
    kind: "you" as const,
    text: "da forma que esta não ta legal, porque as sessions estão concentradas e empilhadas.\n\no ideal é poder escolher cada sessão e ver apenas ela",
    at: NOW - 40 * 60_000,
  },
  {
    kind: "steps" as const,
    at: NOW - 39.5 * 60_000,
    steps: [
      { tool: "Read", target: "crates/bancada-core/src/chat.rs", ok: true },
      { tool: "Edit", target: "crates/bancada-core/src/chat.rs", ok: true },
      { tool: "Bash", target: "cargo test -p bancada-core --lib chat", ok: true },
      { tool: "Bash", target: "make check", ok: false },
      { tool: "Read", target: "web/src/pages/sessions/talk.tsx", ok: true },
      { tool: "Grep", target: "'/Users/henrique/Documents/dev/personal/archwarden'", ok: true },
      { tool: "Edit", target: "web/src/pages/sessions/talk.tsx", ok: true },
    ],
  },
  {
    kind: "agent" as const,
    text: "Entendi. Vou separar em duas metades: uma lista à esquerda e o detalhe ao centro.\n\nO que muda de concreto:\n\n- a lista passa a ser um **índice**, não um empilhamento\n- o detalhe mostra a troca inteira, sem cortar no meio da frase\n- `prose()` passa a valer também no que você escreveu",
    at: NOW - 39 * 60_000,
  },
  {
    kind: "you" as const,
    text: "pode seguir",
    at: NOW - 20 * 60_000,
  },
  {
    kind: "asked" as const,
    text: "De que lado a conversa deve ficar?",
    at: NOW - 2 * 60_000,
    question: {
      header: "Lado",
      prompt: "De que lado a conversa deve ficar?",
      multi: false,
      options: [
        {
          label: "À direita (recomendado)",
          description:
            "Longe da árvore de arquivos, que já ocupa a esquerda em duas das quatro telas.",
          preview: "[ árvore ][ diff ................ ][ conversa ]",
        },
        {
          label: "À esquerda",
          description: "Contra a mesma borda da árvore, que então cede espaço.",
          preview: null,
        },
      ],
    },
  },
];

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
/// Everything registered, as the screen that manages it.
///
/// The real `WorkPage`, answered from fixtures over the stubbed seam. It
/// used to be a copy of the screen written out again here, and a copy is a
/// thing that drifts: the session index did exactly that within an hour of
/// being written twice.
function Work() {
  const [muted, setMuted] = useState<Record<string, boolean>>({ "neo-gitmoji": true });
  const stand = (
    id: string,
    workspace: string,
    runtime: string,
    path: string,
    sessions: number,
    ago: number | null,
  ) => ({
    project: { id, workspace, runtime, path, weight: 1, idleAfterMinutes: 2 },
    sessions,
    lastActivity: ago === null ? null : NOW - ago,
    unreachable: null,
    asking: !muted[id],
  });

  const work = {
    workspaces: [
      {
        workspace: { id: "personal", export: "metadata" as const },
        projects: [
          stand(
            "bancada",
            "personal",
            "this-machine",
            "/Users/henrique/Documents/dev/personal/bancada",
            7,
            4 * 60_000,
          ),
          stand(
            "neo-gitmoji",
            "personal",
            "devbox",
            "/mnt/dev/neo-gitmoji.nvim",
            3,
            2 * 3_600_000,
          ),
        ],
      },
      {
        workspace: { id: "client-x", export: "summary" as const },
        projects: [stand("api", "client-x", "devbox", "/mnt/dev/client-x/api", 2, 40 * 60_000)],
      },
    ],
    orphans: [],
  };

  return (
    <WorkPage
      queue={
        {
          groups: [
            {
              session: "s",
              items: [{ item: { project: "bancada" } }, { item: { project: "bancada" } }],
            },
          ],
          wip: { sessions_waiting: 2, items: 2, limit: 4 },
          watching: 3,
          asking: 3 - Object.values(muted).filter(Boolean).length,
          silenced: Object.values(muted).filter(Boolean).length,
          unreachable: [],
          glances: {},
          elsewhere: null,
        } as never
      }
      work={work as never}
      failed={null}
      onReload={() => {}}
      onOpen={() => {}}
      onMute={(id, on) => setMuted((now) => ({ ...now, [id]: on }))}
      onOpenSettings={() => {}}
      onOpenQueue={() => {}}
    />
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
  const showing = sift(CHANGED, filters);
  const sum = totals(showing);
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
            </Row>
            <Scroller className="min-h-0 flex-1">
              <Stack gap="snug" className="p-3">
                {showing.map((f) => (
                  <FileSection
                    key={f.path}
                    project="bancada"
                    file={f}
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

/// A fifth thing to look at: the sessions of a project, one of them stopped
/// on a question. The question is the case that cannot be judged from code —
/// it has to read as something you could answer, while saying you cannot.
function Sessions() {
  const now = Date.now();
  const rows = SESSIONS(now);

  return (
    <Page>
      <Stack gap="normal">
        <Heading level={1} as="h1">
          Sessions
        </Heading>
        <Divider soft />
        <Stack gap="snug">
          {rows.map((s) => (
            <SessionCard key={s.id} session={s} now={now} onKeep={() => {}} />
          ))}
        </Stack>
      </Stack>
    </Page>
  );
}

/// A function of `now` rather than a constant: relative times are half of
/// what these rows say, and a fixture frozen at import would read "in 0
/// seconds" by the time anything mounted it.
function SESSIONS(now: number) {
  return [
    {
      id: "10414dd9-7337-4efe-a0e4-0c6a7a149993",
      title: "Discutir a tela de sessões e depois construí-la",
      asked: {
        header: "Estado",
        prompt: "Sem a parte de rodando, o que cada linha ainda diz?",
        multi: false,
        options: [
          {
            label: '"Waiting on you" + quando',
            description:
              "O crachá só aparece quando a fila diz que a sessão espera por você, mais a hora relativa.",
            preview:
              "10414dd9   [Waiting on you]   2 min ago\n55a56b23                      1 hour ago",
          },
          {
            label: "Nenhum crachá",
            description: "A linha mostra só a última troca e a hora dela.",
            preview: null,
          },
        ],
      },
      said: "Levantei o terreno.",
      heard: "pode seguir",
      at: now - 2 * 60_000,
      waiting: true,
      kept: false,
      quieted: false,
    },
    {
      id: "55a56b23-995d-47eb-939e-043b2b441bd0",
      title: "Corrigir o falso positivo do config doctor",
      asked: null,
      said: "Não consegui abrir: `Failed(\"/opt/homebrew/bin/limactl exited 128: fatal: cannot change to '/Users/henrique/Documents/dev/personal/archwarden': No such file or directory\")`\n\nPronto. O **doctor** deixa de reclamar de uma regra que guarda `renders`, e o teste que prova isso está em `config/doctor.rs`.\n\n- a checagem passou a olhar as duas dimensões\n- o aviso some sozinho quando a regra tem escopo",
      heard: "roda os testes de novo",
      at: now - 55 * 60_000,
      waiting: false,
      // The long-running one you mean to come back to. Named by hand, so a
      // newer session does not quiet it.
      kept: true,
      quieted: false,
    },
    {
      id: "3edc4601-1111-2222-3333-444455556666",
      title: null,
      asked: null,
      said: null,
      heard: "oi",
      at: now - 3 * 86_400_000,
      waiting: false,
      // Walked away from three days ago, and a newer session has begun
      // since. The state that used to go on asking for you forever.
      kept: false,
      quieted: true,
    },
  ];
}

/// The sessions screen as it ships: an index, one session's detail, and the
/// conversation beside it.
///
/// The three columns at once is the thing that cannot be judged from code.
/// Each was fine alone; together the question cards had to still read as
/// answerable inside 340 pixels, and the detail had to keep a line short
/// enough to read to the end of with a column on either side of it.
function Talking() {
  const now = Date.now();
  const rows = SESSIONS(now);
  const [picked, setPicked] = useState(rows[Number(q.get("pick") ?? 0)]?.id ?? rows[0].id);
  const open = rows.find((s) => s.id === picked) ?? rows[0];

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
        <Row gap="normal" align="baseline">
          <Text as="span" size="sm" tone="muted">
            claude-code · claude-opus-5
          </Text>
          <Text as="span" size="sm" tone="faint">
            2 waiting
          </Text>
        </Row>
      }
      tabs={
        <Row gap="tight">
          {(
            [
              ["Sessions", ChatCircleTextIcon],
              ["Files changed", GitDiffIcon],
              ["Files", FolderOpenIcon],
              ["History", ClockCounterClockwiseIcon],
            ] as const
          ).map(([n, Glyph]) => (
            <Row
              key={n}
              gap="tight"
              className={
                n === "Sessions"
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
          <Row gap="tight" className="ml-2 rounded-lg border border-line bg-raised px-2.5 py-1">
            <SidebarSimpleIcon size={13} className="-scale-x-100" />
            <Text as="span" size="sm" className="text-inherit">
              Conversation
            </Text>
          </Row>
        </Row>
      }
      chat={
        <ChatPanel
          project="bancada"
          sessions={rows}
          session={picked}
          onSession={setPicked}
          onClose={() => {}}
          side="right"
        />
      }
      chatSide="right"
      footer={<Tally summary={{ files: 14, added: 1204, removed: 317, versioned: true }} />}
    >
      <Panes
        index={<SessionIndex sessions={rows} picked={picked} onPick={setPicked} now={now} />}
        subject={
          <Scroller className="min-h-0 flex-1">
            <Stack gap="none" className="p-5">
              <SessionCard session={open} now={now} onKeep={() => {}} />
            </Stack>
          </Scroller>
        }
      />
    </ProjectShell>
  );
}

/// A project pointed at a folder git has never been told about.
///
/// The state that produced the bug: `git diff HEAD` in a plain directory
/// exits 129 with a *usage message*, and the screen printed it. Reproduced
/// here rather than reasoned about — the whole reason this file exists.
function Bare() {
  return (
    <Page>
      <Stack gap="airy">
        <Inset pad="loose">
          <EmptyState
            mark
            headline="This project is not a git repository."
            detail="Nothing to compare against, so there is no diff and no history. The Files tab still reads the tree, and the sessions still say what happened here."
          />
        </Inset>
        <Divider soft />
        <Inset pad="loose">
          <EmptyState
            mark
            headline="Nothing has changed here."
            detail="The tree matches its last commit, down to the last line."
          />
        </Inset>
        <Divider soft />
        <Inset pad="loose">
          <EmptyState
            mark
            headline="No session has run here yet."
            detail="When one does, what it is doing and what it last said will be here."
          />
        </Inset>
        <Divider soft />
        <Tally summary={{ files: 0, added: 0, removed: 0, versioned: false }} />
      </Stack>
    </Page>
  );
}

/// The list the header's project name opens onto.
///
/// Rendered without its popover, for the reason the test is written that way
/// too: a portal in a headless render is a picture of a portal.
function Switcher() {
  const now = Date.now();
  const [picked, setPicked] = useState("bancada");
  const [muted, setMuted] = useState<Record<string, boolean>>({ archwarden: true });
  const stand = (id: string, workspace: string) => ({
    project: {
      id,
      workspace,
      runtime: "this-machine",
      path: `/mnt/dev/${id}`,
      weight: 1,
      idleAfterMinutes: 2,
    },
    sessions: 3,
    lastActivity: now - 90 * 60_000,
    unreachable: null,
    asking: !muted[id],
  });
  const work = {
    workspaces: [
      {
        workspace: { id: "personal" },
        projects: [stand("bancada", "personal"), stand("archwarden", "personal")],
      },
      {
        workspace: { id: "work" },
        projects: [stand("api", "work"), stand("painel", "work")],
      },
      { workspace: { id: "empty" }, projects: [] },
    ],
    orphans: [],
  };
  const silenced = Object.values(muted).filter(Boolean).length;

  return (
    <Page>
      <Stack gap="loose">
        <Card className="w-[22rem] p-1.5">
          <ProjectList
            project={picked}
            queue={
              {
                groups: [
                  {
                    session: "s",
                    items: [
                      {
                        item: { project: "bancada" },
                      },
                      { item: { project: "bancada" } },
                    ],
                  },
                  { session: "t", items: [{ item: { project: "api" } }] },
                ],
                asking: 4 - silenced,
                silenced,
              } as never
            }
            work={work as never}
            onOpen={setPicked}
            onMute={(id, on) => setMuted((now) => ({ ...now, [id]: on }))}
          />
        </Card>
      </Stack>
    </Page>
  );
}

/// The two settings that arrived with the conversation: which edge it sits
/// against, and which keystroke shows it.
function Keys() {
  const [keys, setKeys] = useState(DEFAULTS);
  const [side, setSide] = useState<"left" | "right">("right");

  return (
    <Page>
      <Stack gap="loose">
        <SidePanel side={side} onChoose={setSide} />
        <KeysPanel keys={keys} onChange={setKeys} />
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
  ) : q.has("sessions") ? (
    <Sessions />
  ) : q.has("talking") ? (
    <Talking />
  ) : q.has("keys") ? (
    <Keys />
  ) : q.has("switcher") ? (
    <Switcher />
  ) : q.has("bare") ? (
    <Bare />
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
