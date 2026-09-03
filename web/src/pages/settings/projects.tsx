import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { FolderOpenIcon } from "@phosphor-icons/react";
import type { Config, Limits, Preset, Project } from "@/core/settings";
import { THIS_MACHINE, evidenceOf, logDirName, presetLabel, whyNot } from "@/core/settings";
import { Badge, Button, Card, Heading, Mono, Text } from "@/components";
import { ChoiceField, Field, NewThing, Notice, Section } from "@/composites";
import { Full, Grid, Inset, Row, Stack } from "@/frame";
import { Disclosure } from "@/components";
import { Resolved, Threshold, withLimits } from "@/pages/settings/limits";
import { useDraftProject } from "@/pages/settings/logic";
import { useText } from "@/lib/language";

export function ProjectsPanel({
  config,
  limits,
  onRegister,
  onForget,
}: {
  config: Config;
  /// What each project's numbers came out as, keyed by id. Resolved by the
  /// core, because the order of precedence is a rule and this screen is not
  /// the place to keep a second copy of it. Empty while it is being read.
  limits: Record<string, Limits>;
  onRegister: (p: Project, previous?: string) => void;
  onForget: (id: string) => void;
}) {
  const t = useText();
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <Stack gap="loose">
      <Section title={t("Watched")}>
        <Registered config={config} limits={limits} onForget={onForget} onEdit={setEditing} />
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
  limits,
  onForget,
  onEdit,
}: {
  config: Config;
  limits: Record<string, Limits>;
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
                {p.limits?.preset ? <Badge>{presetLabel(p.limits.preset, t)}</Badge> : null}
              </Row>

              {/* What the numbers came out as, rather than what this row
                  states. A project stating nothing is the normal case, and
                  a card that showed only what it states would be silent
                  about every project on the screen. */}
              {limits[p.id] ? <Resolved limits={limits[p.id]} workspace={p.workspace} /> : null}
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
export function ProjectForm({
  config,
  editing,
  into,
  onSubmit,
  onCancel,
}: {
  config: Config;
  editing: Project | null;
  /// The workspace this is being registered into, when the form was opened
  /// from inside one. Filling it in from where you clicked is the whole
  /// difference between adding a project here and going to the settings.
  into?: string;
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

  // Once, on the way in. Setting it on every render would fight whoever is
  // typing in the field.
  useEffect(() => {
    if (into) setDraft((d) => (d.workspace ? d : { ...d, workspace: into }));
  }, [into, setDraft]);

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
              label={t("Path")}
              value={draft.path}
              onChange={setPath}
              // The critical fact used to live in the placeholder, which
              // disappears on the first keystroke — exactly when it is
              // needed. It names the machine, so there is nothing to work
              // out about which spelling is wanted.
              hint={
                local
                  ? t("The folder itself.")
                  : t(
                      "As {id} spells it — the path you would use inside it, not the one here.",
                      {
                        id: draft.runtime,
                      },
                    )
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
            label={t("Name")}
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

          {/* Not folded away. This is the confidentiality boundary — which
              supervisor may read this work, and what it may let out — and it
              is the one field on the form whose wrong answer is not
              recoverable by noticing later. */}
          <ChoiceField
            label={t("Workspace")}
            value={draft.workspace}
            onChange={(workspace) => setDraft({ ...draft, workspace })}
            choices={config.workspaces.map((w) => ({ value: w.id, label: w.id }))}
            hint={t("Who this work belongs to, and what its supervisor may let out.")}
          />

          <Full>
            <Disclosure summary={t("How fast waiting hurts")}>
              <Grid columns={2}>
                {/* The preset first, because it is the answer for almost
                    every project and it is what makes the four boxes below
                    it optional. A five-hour session is normal in a large
                    refactor and strange almost everywhere else. */}
                <ChoiceField
                  label={t("Kind of work")}
                  value={draft.limits?.preset ?? ""}
                  onChange={(v) =>
                    setDraft(
                      withLimits(draft, { preset: (v || undefined) as Preset | undefined }),
                    )
                  }
                  choices={[
                    { value: "", label: t("Inherit from the workspace") },
                    ...(["normal", "longRefactor", "exploratory"] as const).map((k) => ({
                      value: k,
                      label: presetLabel(k, t),
                    })),
                  ]}
                  hint={t(
                    "Sets every threshold at once. Say a number below to depart from it.",
                  )}
                />
                <Threshold
                  label={t("Weight")}
                  value={draft.limits?.weight}
                  onChange={(weight) => setDraft(withLimits(draft, { weight }))}
                  hint={t(
                    "Scales how fast waiting hurts. Never overrides the kind of decision.",
                  )}
                />
                <Threshold
                  label={t("Quiet for (minutes)")}
                  value={draft.limits?.idleAfterMinutes}
                  onChange={(idleAfterMinutes) =>
                    setDraft(withLimits(draft, { idleAfterMinutes }))
                  }
                  hint={t("How long a finished turn stays quiet before it is worth your eyes.")}
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
