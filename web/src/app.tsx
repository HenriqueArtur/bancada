import { useEffect, useState } from "react";
import {
  ClockCounterClockwiseIcon,
  FolderOpenIcon,
  GitDiffIcon,
  type Icon,
  ChatCircleTextIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import {
  apply,
  remember,
  resolve,
  stored,
  systemIsDark,
  type Side,
  type Theme,
} from "@/core/appearance";
import {
  current,
  remember as rememberLanguage,
  stored as storedLanguage,
  type Language,
} from "@/core/language";
import { loadRepo } from "@/core/git";
import { live } from "@/core/live";
import { loadSummary, type Summary } from "@/core/review";
import { loadSettings } from "@/core/settings";
import { name, titleOf } from "@/core/window";
import {
  apply as applyZoom,
  remember as rememberZoom,
  stepped,
  stored as storedZoom,
} from "@/core/zoom";
import { spell, stored as storedKeys, type Action, type Chord } from "@/core/shortcuts";
import { rememberSide, side as storedSide } from "@/core/appearance";
import { useKeys } from "@/lib/keys";
import { Speaks } from "@/lib/language";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { Row } from "@/frame";
import { AppShell } from "@/layouts";
import type { Session } from "@/core/sessions";
import { ChatPanel } from "@/pages/sessions/panel";
import { useSessions } from "@/pages/sessions/view";
import {
  ChangesPage,
  CockpitView,
  FilesPage,
  GitPage,
  SessionsPage,
  SettingsPage,
  WorkPage,
  useCockpit,
} from "@/pages";
import { Button } from "@/components";

import type { Inside as Shared, Origin } from "@/pages/_shared";
import { useText } from "@/lib/language";

/// What the configuration says about one project, for the chrome above it.
interface About {
  workspace: string;
  harness: string | null;
  model: string | null;
}

type Where =
  | { at: "cockpit" }
  | { at: "work" }
  /// `from` is where the project was opened, so the way back leads there.
  /// Always sending you to the queue is right half the time, and the other
  /// half is the product deciding you were somewhere else.
  | { at: "sessions"; project: string; from: Origin }
  | { at: "changes"; project: string; from: Origin }
  | { at: "files"; project: string; from: Origin }
  | { at: "git"; project: string; from: Origin };

/// The screens a project has, in the order somebody works through them:
/// who is working and on what, what changed, the tree it changed, and what
/// has already landed.
const INSIDE = ["sessions", "changes", "files", "git"] as const;
type Inside = (typeof INSIDE)[number];

/// Out here rather than beside the names: a glyph reads nothing from the
/// translator, and the tab strip below needs it too.
const GLYPH: Record<Inside, Icon> = {
  sessions: ChatCircleTextIcon,
  changes: GitDiffIcon,
  files: FolderOpenIcon,
  git: ClockCounterClockwiseIcon,
};

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
  const { queue, failed, mute, asking } = useCockpit();
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

  // Every keystroke the window answers to, in one registry — see
  // `core/shortcuts`. The zoom used to hang its own listener here, and the
  // second one beside it is how a window ends up with two keys doing the
  // same thing and nowhere to look them up.
  const [keys, setKeys] = useState<Record<Action, Chord>>(storedKeys);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSide, setChatSide] = useState(storedSide);
  useEffect(() => rememberSide(chatSide), [chatSide]);

  // One step through the project's screens, skipping the one that is not
  // offered. Wraps, because four tabs is a ring and stopping at the end
  // would make the key do nothing once in every four presses.
  const move = (what: "tab.next" | "tab.previous") =>
    setWhere((now) => {
      if (!("project" in now)) return now;
      const open = INSIDE.filter((at) => at !== "git" || isGit);
      const i = open.indexOf(now.at as Inside);
      const step = what === "tab.next" ? 1 : open.length - 1;
      return { ...now, at: open[(i + step) % open.length] };
    });

  useKeys(keys, {
    chat: () => setChatOpen((now) => !now),
    "zoom.reset": () => setZoom(0),
    "zoom.in": () => setZoom((now) => stepped(now, "in")),
    "zoom.out": () => setZoom((now) => stepped(now, "out")),
    "tab.next": () => move("tab.next"),
    "tab.previous": () => move("tab.previous"),
  });

  // What the configuration says about each project. Read once and kept,
  // because it has to be on screen the whole time you are inside one — the
  // workspace is the confidentiality boundary, and a diff shown without one
  // is a diff whose rules nobody stated. The harness rides along because it
  // comes from the same read and answers the same kind of question.
  const [about, setAbout] = useState<Record<string, About>>({});
  useEffect(() => {
    loadSettings()
      .then((c) => {
        const machine = Object.fromEntries(c.runtimes.map((r) => [r.id, r]));
        setAbout(
          Object.fromEntries(
            c.projects.map((p) => [
              p.id,
              {
                workspace: p.workspace,
                harness: machine[p.runtime]?.harness ?? null,
                model: machine[p.runtime]?.model ?? null,
              },
            ]),
          ),
        );
      })
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
    sessions: t("Sessions"),
    changes: t("Files changed"),
    files: t("Files"),
    git: t("History"),
  };
  const HERE: Record<Where["at"], string> = {
    cockpit: t("Needs you"),
    work: t("Your work"),
    ...NAME,
  };

  const project = "project" in where ? where.project : null;

  // Read once, here, because two things need it: the Sessions screen and the
  // conversation panel's own picker. Two readings of "which sessions are
  // here" is how a product ends up disagreeing with itself about what is
  // waiting on you.
  const { sessions, failed: sessionsFailed } = useSessions(project ?? "");
  const [talking, setTalking] = useState<string | null>(null);
  useEffect(() => {
    // Whatever is stopped on you, and only until you pick another. Re-picked
    // on every reload it would move the panel off what you were reading.
    setTalking((now) =>
      now && sessions?.some((s) => s.id === now)
        ? now
        : ((sessions?.find((s) => s.waiting) ?? sessions?.[0])?.id ?? null),
    );
  }, [sessions]);

  // How much has moved, for the strip along the bottom of all four screens.
  // Read here rather than per screen, so the number cannot differ between
  // two tabs of the same project.
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    if (!project) return;
    setSummary(null);
    let alive = true;
    const read = () => {
      loadSummary(project)
        .then((s) => alive && setSummary(s))
        // Silent. The footer already reads "still counting", and a project
        // git has never been told about is a normal thing to open.
        .catch(() => {});
    };
    read();
    const channel = live(read);
    return () => {
      alive = false;
      channel.stop();
    };
  }, [project]);

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
      side={chatSide}
      onChooseSide={setChatSide}
      keys={keys}
      onChooseKeys={setKeys}
    />
  );

  if (where.at === "cockpit") {
    return (
      <>
        <CockpitView
          queue={queue}
          mute={mute}
          asking={asking}
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
    <ProjectTabs
      shown={shown}
      at={where.at}
      name={NAME}
      onGo={(at) => setWhere({ at, project: where.project, from: where.from })}
      chatOpen={chatOpen}
      chatSide={chatSide}
      chord={keys.chat}
      onChat={() => setChatOpen((now) => !now)}
    />
  );

  const inside = {
    project: where.project,
    workspace: about[where.project]?.workspace ?? null,
    harness: about[where.project]?.harness ?? null,
    model: about[where.project]?.model ?? null,
    summary,
    queue,
    from: where.from,
    onBack: () => setWhere({ at: where.from }),
    tabs,
    chat: chatOpen ? (
      <ChatPanel
        project={where.project}
        sessions={sessions ?? []}
        session={talking}
        onSession={setTalking}
        onClose={() => setChatOpen(false)}
        side={chatSide}
      />
    ) : undefined,
    chatSide,
  };

  return (
    <>
      <Screen
        at={where.at}
        inside={inside}
        sessions={sessions}
        failed={sessionsFailed}
        picked={talking}
        onPick={setTalking}
      />
      {dialog}
    </>
  );
}

/// Where you can go from inside a project, and what you can see from
/// wherever you already are.
///
/// The two are in one strip but not in one list: the conversation is not a
/// fifth screen, so it sits past a gap and says so by staying put when the
/// tab changes.
function ProjectTabs({
  shown,
  at,
  name,
  onGo,
  chatOpen,
  chatSide,
  chord,
  onChat,
}: {
  shown: readonly Inside[];
  at: Inside;
  name: Record<Inside, string>;
  onGo: (at: Inside) => void;
  chatOpen: boolean;
  chatSide: Side;
  chord: Chord;
  onChat: () => void;
}) {
  const t = useText();
  return (
    <Row gap="tight">
      {shown.map((one) => {
        const Glyph = GLYPH[one];
        return (
          <Button
            key={one}
            tone={at === one ? "outline" : "ghost"}
            size="sm"
            onClick={() => onGo(one)}
          >
            <Glyph size={13} />
            {name[one]}
          </Button>
        );
      })}
      {/* The key is the fast way and the button is the discoverable one; a
          shortcut nothing on the screen names is a shortcut nobody finds. */}
      <Button
        tone={chatOpen ? "outline" : "ghost"}
        size="sm"
        className="ml-2"
        aria-pressed={chatOpen}
        title={`${t("Conversation")} · ${spell(chord, navigator.platform.startsWith("Mac"))}`}
        onClick={onChat}
      >
        <SidebarSimpleIcon
          size={13}
          className={chatSide === "right" ? "-scale-x-100" : undefined}
        />
        {t("Conversation")}
      </Button>
    </Row>
  );
}

/// Which of the four is on screen.
///
/// Split out so the shell above it stays about state rather than about
/// rendering, and so adding a fifth screen is one place rather than three.
function Screen({
  at,
  inside,
  sessions,
  failed,
  picked,
  onPick,
}: {
  at: Inside;
  inside: Shared;
  sessions: Session[] | null;
  failed: string | null;
  picked: string | null;
  onPick: (id: string) => void;
}) {
  if (at === "changes") return <ChangesPage {...inside} />;
  if (at === "files") return <FilesPage {...inside} />;
  if (at === "git") return <GitPage {...inside} />;
  return (
    <SessionsPage
      {...inside}
      sessions={sessions}
      failed={failed}
      picked={picked}
      onPick={onPick}
    />
  );
}
