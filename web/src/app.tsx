import { useState } from "react";
import { Text } from "@/components";
import { Banner } from "@/composites";
import { Row } from "@/frame";
import { AppShell } from "@/layouts";
import { BackToQueue, Elsewhere, WipBar } from "@/pages/_shared";
import { CockpitView, FilesPage, ReviewPage, SettingsPage, WorkPage, useCockpit } from "@/pages";
import { Button } from "@/components";

type Where =
  | { at: "cockpit" }
  | { at: "work" }
  | { at: "review"; project: string }
  | { at: "files"; project: string };

/// Which screen, and the queue that every screen carries.
///
/// Deliberately the only place that knows all the screens exist. Each page
/// owns its own data; this owns the queue, because the queue is what the
/// badge, the notification and every screen's header are made of.
export function App() {
  const { queue, failed, mute } = useCockpit();
  const [where, setWhere] = useState<Where>({ at: "cockpit" });
  const [settings, setSettings] = useState(false);

  if (failed) {
    return (
      <AppShell title="Needs you">
        <Banner label="Could not reach the core" tone="alarm">
          <Text as="span" size="sm" tone="alarm">
            {failed}
          </Text>
        </Banner>
      </AppShell>
    );
  }
  if (!queue) return <AppShell title="Needs you">{null}</AppShell>;

  const dialog = (
    <SettingsPage open={settings} onOpenChange={setSettings} onChanged={() => setWhere({ at: "cockpit" })} />
  );

  if (where.at === "cockpit") {
    return (
      <>
        <CockpitView
          queue={queue}
          mute={mute}
          onOpenProject={(project) => setWhere({ at: "review", project })}
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
          onOpen={(project) => setWhere({ at: "review", project })}
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
        onClick={() => setWhere({ at: "review", project: where.project })}
      >
        What changed
      </Button>
      <Button
        tone={where.at === "files" ? "outline" : "ghost"}
        size="sm"
        onClick={() => setWhere({ at: "files", project: where.project })}
      >
        Files
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
          onBack={() => setWhere({ at: "cockpit" })}
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
        above={<BackToQueue queue={queue} onBack={() => setWhere({ at: "cockpit" })} />}
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
