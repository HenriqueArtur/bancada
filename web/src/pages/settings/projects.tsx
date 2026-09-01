import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { FolderOpenIcon } from "@phosphor-icons/react";
import type { Config, Project } from "@/core/settings";
import { THIS_MACHINE, evidenceOf, logDirName, whyNot } from "@/core/settings";
import { Badge, Button, Card, Heading, Mono, Text } from "@/components";
import { ChoiceField, Field, NewThing, Notice, Section } from "@/composites";
import { Full, Grid, Inset, Row, Stack } from "@/frame";
import { Disclosure } from "@/components";
import { useDraftProject } from "@/pages/settings/logic";
import { useText } from "@/lib/language";

export function ProjectsPanel({
  config,
  onRegister,
  onForget,
}: {
  config: Config;
  onRegister: (p: Project, previous?: string) => void;
  onForget: (id: string) => void;
}) {
  const t = useText();
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <Stack gap="loose">
      <Section title={t("Watched")}>
        <Registered config={config} onForget={onForget} onEdit={setEditing} />
      </Section>
      <ProjectForm
        config={config}
        editing={editing}
        onCancel={() => setEditing(null)}
        onSubmit={(p, previous) => {
          onRegister(p, previous);
          setEditing(null);
        }}
      />
    </Stack>
  );
}

/// One registered project, with room to read it.
///
/// A table put five columns and a forty-character path into six hundred
/// pixels, and every one of them lost. A card gives the path its own line
/// and turns the rest into what it actually is: a handful of facts about
/// one thing, not a row of a spreadsheet with four other things.
function Registered({
  config,
  onForget,
  onEdit,
}: {
  config: Config;
  onForget: (id: string) => void;
  onEdit: (p: Project) => void;
}) {
  const t = useText();
  if (config.projects.length === 0) {
    return (
      <Text tone="muted" size="sm">
        {t("None yet.")}
      </Text>
    );
  }
  return (
    <Stack gap="snug">
      {config.projects.map((p) => (
        <Card key={p.id}>
          <Inset pad="normal">
            <Stack gap="snug">
              <Row gap="snug" align="baseline" justify="between">
                <Heading level={3} as="h3">
                  {p.id}
                </Heading>
                <Row gap="tight">
                  <Button tone="ghost" size="sm" onClick={() => onEdit(p)}>
                    {t("Edit")}
                  </Button>
                  <Button tone="ghost" size="sm" onClick={() => onForget(p.id)}>
                    {t("Forget")}
                  </Button>
                </Row>
              </Row>

              {/* Its own line, and allowed to wrap. A truncated path is a
                  path you cannot check, which is the only reason it is on
                  the screen. */}
              <Mono className="break-all leading-relaxed">{p.path}</Mono>

              <Row gap="tight" wrap>
                <Badge>{p.runtime === THIS_MACHINE ? t("This machine") : p.runtime}</Badge>
                <Badge>{p.workspace}</Badge>
                <Badge
                  title={t(
                    "How fast waiting hurts here. Scales time, never the kind of decision.",
                  )}
                >
                  {t("Weight ×{n}", { n: p.weight })}
                </Badge>
                <Badge
                  title={t("How long a finished turn stays quiet before it is worth your eyes")}
                >
                  {t("Quiet {n} min", { n: p.idleAfterMinutes })}
                </Badge>
              </Row>
            </Stack>
          </Inset>
        </Card>
      ))}
    </Stack>
  );
}

/// Pick a folder, and be shown what watching it would mean.
///
/// The confirmation is evidence — *four sessions already recorded here* —
/// rather than the encoded directory name this used to print. That was
/// jargon asking a person to verify what the product can verify itself.
function ProjectForm({
  config,
  editing,
  onSubmit,
  onCancel,
}: {
  config: Config;
  editing: Project | null;
  onSubmit: (p: Project, previous?: string) => void;
  onCancel: () => void;
}) {
  const t = useText();
  const { draft, setDraft, setPath, preview, clear, load } = useDraftProject();
  const [picking, setPicking] = useState(false);

  // Editing fills the same form. Two ways to write one row is one more than
  // the shape needs, and the second one always drifts.
  useEffect(() => {
    if (editing) load(editing);
  }, [editing, load]);

  const local = draft.runtime === THIS_MACHINE;
  const blocked = whyNot(draft, config, t, editing?.id);
  const evidence = evidenceOf(preview, t);

  const browse = async () => {
    setPicking(true);
    try {
      const chosen = await pickFolder({ directory: true, multiple: false });
      if (typeof chosen === "string") setPath(chosen);
    } finally {
      setPicking(false);
    }
  };

  return (
    <NewThing
      title={t("Watch a project")}
      blurb={t("Pick a folder and bancada will say what it found there.")}
      editing={editing?.id}
    >
      <Stack gap="normal">
        <Grid columns={2}>
          <Full>
            <Field
              label={t("Where does it live?")}
              value={draft.path}
              onChange={setPath}
              placeholder={
                local ? "/Users/you/dev/thing" : t("The path as the guest spells it")
              }
              after={
                // Only for this machine. A guest path cannot be browsed
                // from here, and a picker that quietly returned the host's
                // spelling of it would register something that does not
                // exist.
                local ? (
                  <Button tone="outline" onClick={browse} disabled={picking} type="button">
                    <FolderOpenIcon size={15} />
                    {picking ? "…" : t("Browse")}
                  </Button>
                ) : undefined
              }
            />
          </Full>

          {evidence ? (
            <Full>
              <Notice tone={evidence.tone}>
                {evidence.says}
                {preview?.reachable && !preview.versioned
                  ? ` · ${t("Not a git repository, so there will be no diff to review.")}`
                  : ""}
              </Notice>
            </Full>
          ) : null}

          <Field
            label={t("Call it")}
            value={draft.id}
            onChange={(id) => setDraft({ ...draft, id })}
            placeholder={t("From the folder name")}
          />
          <ChoiceField
            label={t("Runs on")}
            value={draft.runtime}
            onChange={(runtime) => setDraft({ ...draft, runtime })}
            choices={config.runtimes.map((r) => ({
              value: r.id,
              label: r.id === THIS_MACHINE ? t("This machine") : r.id,
            }))}
          />

          <Full>
            <Disclosure summary={t("Whose it is, and how fast waiting hurts")}>
              <Grid columns={2}>
                <ChoiceField
                  label={t("Workspace")}
                  value={draft.workspace}
                  onChange={(workspace) => setDraft({ ...draft, workspace })}
                  choices={config.workspaces.map((w) => ({ value: w.id, label: w.id }))}
                />
                <Field
                  label={t("Weight")}
                  value={String(draft.weight)}
                  onChange={(v) => setDraft({ ...draft, weight: Number(v) || 1 })}
                  hint={t(
                    "Scales how fast waiting hurts. Never overrides the kind of decision.",
                  )}
                />
                <Field
                  label={t("Quiet for (minutes) before it counts")}
                  value={String(draft.idleAfterMinutes)}
                  onChange={(v) => setDraft({ ...draft, idleAfterMinutes: Number(v) || 1 })}
                />
                {draft.path ? (
                  <Stack gap="tight" justify="end">
                    <Text size="sm" tone="faint">
                      {t("Logs")}
                    </Text>
                    <Mono tone="faint">projects/{logDirName(draft.path)}</Mono>
                  </Stack>
                ) : null}
              </Grid>
            </Disclosure>
          </Full>
        </Grid>

        <Row gap="normal" wrap>
          <Button
            tone="primary"
            disabled={blocked !== null}
            onClick={() => {
              if (!blocked) {
                onSubmit(draft, editing?.id);
                clear();
              }
            }}
          >
            {editing ? t("Save changes") : t("Watch it")}
          </Button>
          {editing ? (
            <Button
              tone="ghost"
              onClick={() => {
                clear();
                onCancel();
              }}
            >
              {t("Cancel")}
            </Button>
          ) : null}
          {blocked ? (
            <Text tone="muted" size="sm">
              {blocked}
            </Text>
          ) : null}
        </Row>
      </Stack>
    </NewThing>
  );
}
