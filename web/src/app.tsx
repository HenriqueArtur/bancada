import { useEffect, useState } from "react";
import {
  ClockCounterClockwiseIcon,
  FolderOpenIcon,
  GitDiffIcon,
  type Icon,
  QuotesIcon,
} from "@phosphor-icons/react";
import { apply, remember, resolve, stored, systemIsDark, type Theme } from "@/core/appearance";
import {
  current,
  remember as rememberLanguage,
  stored as storedLanguage,
  type Language,
} from "@/core/language";
import { loadRepo } from "@/core/git";
import { loadSettings } from "@/core/settings";
import { name, titleOf } from "@/core/window";
import {
  stepped,
  apply as applyZoom,
  pressed,
  remember as rememberZoom,
  stored as storedZoom,
} from "@/core/zoom";
import { Speaks } from "@/lib/language";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { Row } from "@/frame";
import { AppShell } from "@/layouts";
import {
  ChangesPage,
  CockpitView,
  FilesPage,
  GitPage,
  SaidPage,
  SettingsPage,
  WorkPage,
  useCockpit,
} from "@/pages";
import { Button } from "@/components";

import type { Origin } from "@/pages/_shared";
import { useText } from "@/lib/language";

type Where =
  | { at: "cockpit" }
  | { at: "work" }
  /// `from` is where the project was opened, so the way back leads there.
  /// Always sending you to the queue is right half the time, and the other
  /// half is the product deciding you were somewhere else.
  | { at: "said"; project: string; from: Origin }
  | { at: "changes"; project: string; from: Origin }
  | { at: "files"; project: string; from: Origin }
  | { at: "git"; project: string; from: Origin };

/// The screens a project has, in the order somebody works through them:
/// what was promised, what it did, the tree it did it to, and what has
/// already landed.
const INSIDE = ["said", "changes", "files", "git"] as const;
type Inside = (typeof INSIDE)[number];

/// Which screen, and the queue that every screen carries.
///
/// Deliberately the only place that knows all the screens exist. Each page
/// owns its own data; this owns the queue, because the queue is what the
/// badge, the notification and every screen's header are made of.
/// The window, speaking whatever it was told to.
///
/// Split from `Cockpit` so the language sits *above* everything that reads
/// it: `useText` is a context, and a provider that lived inside the screens
/// could not change what the screens already rendered.
export function App() {
  const [language, setLanguage] = useState<Language | null>(storedLanguage);
  const speaking = language ?? current(navigator.languages ?? [navigator.language]);

  useEffect(() => {
    if (language) rememberLanguage(language);
  }, [language]);

  return (
    <Speaks language={speaking}>
      <Cockpit language={language} onChooseLanguage={setLanguage} />
    </Speaks>
  );
}

function Cockpit({
  language,
  onChooseLanguage,
}: {
  language: Language | null;
  onChooseLanguage: (l: Language | null) => void;
}) {
  const { queue, failed, mute } = useCockpit();
  const [where, setWhere] = useState<Where>({ at: "cockpit" });
  const [settings, setSettings] = useState(false);
  const t = useText();
  const [theme, setTheme] = useState<Theme>(stored);

  useEffect(() => {
    remember(theme);
    apply(resolve(theme, systemIsDark()));
  }, [theme]);

  // How large the window draws itself, kept across restarts.
  //
  // The listener is here rather than on any screen: the keys work wherever
  // the focus is, which is the whole point of them, and one listener above
  // everything cannot disagree with a second one further down.
  const [zoom, setZoom] = useState<number>(storedZoom);
  useEffect(() => {
    rememberZoom(zoom);
    applyZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    const listen = (e: KeyboardEvent) => {
      const what = pressed(e);
      if (!what) return;
      // Chromium has its own zoom on these keys and it fights with ours —
      // two scales multiplied, and neither control able to undo the other.
      e.preventDefault();
      setZoom((now) => stepped(now, what));
    };
    // Captured on the way down. Monaco binds these keys for its own font
    // size and stops the event before it bubbles, so a listener waiting at
    // the bottom would work everywhere except inside the file being read.
    window.addEventListener("keydown", listen, true);
    return () => window.removeEventListener("keydown", listen, true);
  }, []);

  // Which workspace each project belongs to. Read once and kept, because it
  // has to be on screen the whole time you are inside a project — the
  // workspace is the confidentiality boundary, and a diff shown without one
  // is a diff whose rules nobody stated.
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({});
  useEffect(() => {
    loadSettings()
      .then((c) =>
        setWorkspaces(Object.fromEntries(c.projects.map((p) => [p.id, p.workspace]))),
      )
      // The settings screen says so far better than a header can. Here the
      // honest fallback is to name the project and not its workspace.
      .catch(() => {});
  }, []);

  // Whether the open project is a repository at all. The history tab is only
  // a tab if there is a history; a directory git has never been told about
  // is a normal thing for a project to point at.
  // Named here rather than in each page, so the four cannot drift apart and
  // so the order is one decision in one place. The window title reads from
  // the same map, which is why it is above everything that returns early.
  const NAME: Record<Inside, string> = {
    said: t("What they said"),
    changes: t("Files changed"),
    files: t("Files"),
    git: t("History"),
  };
  const GLYPH: Record<Inside, Icon> = {
    said: QuotesIcon,
    changes: GitDiffIcon,
    files: FolderOpenIcon,
    git: ClockCounterClockwiseIcon,
  };
  const HERE: Record<Where["at"], string> = {
    cockpit: t("Needs you"),
    work: t("Your work"),
    ...NAME,
  };

  const project = "project" in where ? where.project : null;

  useEffect(() => {
    name(titleOf(queue?.wip.sessions_waiting ?? 0, project, HERE[where.at]));
  });
  const [isGit, setIsGit] = useState(false);
  useEffect(() => {
    if (!project) return;
    setIsGit(false);
    let alive = true;
    loadRepo(project)
      .then((r) => alive && setIsGit(r.isGit))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project]);

  if (failed) {
    return (
      <AppShell title={t("Needs you")}>
        <Banner label={t("Could not reach the core")} tone="alarm">
          <Text as="span" size="sm" tone="alarm">
            {failed}
          </Text>
        </Banner>
      </AppShell>
    );
  }
  if (!queue) return <AppShell title={t("Needs you")}>{null}</AppShell>;

  const dialog = (
    <SettingsPage
      open={settings}
      onOpenChange={setSettings}
      onChanged={() => setWhere({ at: "cockpit" })}
      theme={theme}
      onChooseTheme={setTheme}
      language={language}
      onChooseLanguage={onChooseLanguage}
      zoom={zoom}
      onChooseZoom={setZoom}
    />
  );

  if (where.at === "cockpit") {
    return (
      <>
        <CockpitView
          queue={queue}
          mute={mute}
          onOpenProject={(project) => setWhere({ at: "changes", project, from: "cockpit" })}
          onOpenSettings={() => setSettings(true)}
          onOpenWork={() => setWhere({ at: "work" })}
        />
        {dialog}
      </>
    );
  }

  if (where.at === "work") {
    return (
      <>
        <WorkPage
          queue={queue}
          onOpen={(project) => setWhere({ at: "changes", project, from: "work" })}
          onOpenSettings={() => setSettings(true)}
          onOpenQueue={() => setWhere({ at: "cockpit" })}
        />
        {dialog}
      </>
    );
  }

  const shown = INSIDE.filter((at) => at !== "git" || isGit);
  const tabs = (
    <Row gap="tight">
      {shown.map((at) => {
        const Glyph = GLYPH[at];
        return (
          <Button
            key={at}
            tone={where.at === at ? "outline" : "ghost"}
            size="sm"
            onClick={() => setWhere({ at, project: where.project, from: where.from })}
          >
            <Glyph size={13} />
            {NAME[at]}
          </Button>
        );
      })}
    </Row>
  );

  const SCREEN: Record<Inside, typeof FilesPage> = {
    said: SaidPage,
    changes: ChangesPage,
    files: FilesPage,
    git: GitPage,
  };
  const Screen = SCREEN[where.at];
  return (
    <>
      <Screen
        project={where.project}
        workspace={workspaces[where.project] ?? null}
        queue={queue}
        from={where.from}
        onBack={() => setWhere({ at: where.from })}
        tabs={tabs}
      />
      {dialog}
    </>
  );
}
