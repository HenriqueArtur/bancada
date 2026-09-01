import { useEffect, useState } from "react";
import { apply, remember, resolve, stored, systemIsDark, type Theme } from "@/core/appearance";
import {
  current,
  remember as rememberLanguage,
  stored as storedLanguage,
  type Language,
} from "@/core/language";
import { Speaks } from "@/lib/language";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { Row } from "@/frame";
import { AppShell } from "@/layouts";
import { BackToQueue, Elsewhere, WipBar } from "@/pages/_shared";
import {
  CockpitView,
  FilesPage,
  ReviewPage,
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
  | { at: "review"; project: string; from: Origin }
  | { at: "files"; project: string; from: Origin };

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
    />
  );

  if (where.at === "cockpit") {
    return (
      <>
        <CockpitView
          queue={queue}
          mute={mute}
          onOpenProject={(project) => setWhere({ at: "review", project, from: "cockpit" })}
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
          onOpen={(project) => setWhere({ at: "review", project, from: "work" })}
          onOpenSettings={() => setSettings(true)}
          onOpenQueue={() => setWhere({ at: "cockpit" })}
        />
        {dialog}
      </>
    );
  }

  const tabs = (
    <Row gap="tight">
      <Button
        tone={where.at === "review" ? "outline" : "ghost"}
        size="sm"
        onClick={() => setWhere({ at: "review", project: where.project, from: where.from })}
      >
        {t("What changed")}
      </Button>
      <Button
        tone={where.at === "files" ? "outline" : "ghost"}
        size="sm"
        onClick={() => setWhere({ at: "files", project: where.project, from: where.from })}
      >
        {t("Files")}
      </Button>
    </Row>
  );

  // The file pane gets the whole window; everything else keeps the measured
  // column. Prose wants a narrow line and an editor wants every pixel, and
  // one shell cannot be right for both.
  if (where.at === "files") {
    return (
      <>
        <FilesPage
          project={where.project}
          queue={queue}
          from={where.from}
          onBack={() => setWhere({ at: where.from })}
          tabs={tabs}
        />
        {dialog}
      </>
    );
  }

  return (
    <>
      <AppShell
        wide
        title={where.project}
        above={
          <BackToQueue
            queue={queue}
            from={where.from}
            onBack={() => setWhere({ at: where.from })}
          />
        }
        banner={<Elsewhere path={queue.elsewhere} />}
        aside={
          <Row gap="normal">
            <WipBar wip={queue.wip} />
            {tabs}
          </Row>
        }
      >
        <ReviewPage project={where.project} />
      </AppShell>
      {dialog}
    </>
  );
}
