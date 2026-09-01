import { useEffect, useState } from "react";
import type { Config, Workspace } from "@/core/settings";
import type { Translate } from "@/core/language";
import { exportsAs } from "@/core/work";
import { Badge, Button, Card, Heading, Text } from "@/components";
import { ChoiceField, Field, NewThing, Notice, Section } from "@/composites";
import { Grid, Inset, Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

function levels(t: Translate) {
  return [
    { value: "metadata", label: t("Sealed · metadata only") },
    { value: "summary", label: t("Exports summaries") },
    { value: "full", label: t("Exports everything") },
  ];
}

type Level = NonNullable<Workspace["export"]>;

/// The boundary, as a thing you can make and change.
///
/// A project must name a workspace, so a cockpit with none registered cannot
/// hold a project at all — and until this existed the only way out was to
/// edit the configuration by hand.
export function WorkspacesPanel({
  config,
  onRegister,
  onForget,
  failed,
}: {
  config: Config;
  onRegister: (w: Workspace, previous?: string) => void;
  onForget: (id: string) => void;
  /// Why the last change was refused — forgetting one that still holds work
  /// is the case, and the message names what it holds.
  failed: string | null;
}) {
  const t = useText();
  const [editing, setEditing] = useState<Workspace | null>(null);

  return (
    <Stack gap="loose">
      {failed ? <Notice tone="missing">{failed}</Notice> : null}

      <Section title={t("Registered")}>
        {config.workspaces.length === 0 ? (
          <Text tone="muted" size="sm">
            {t("None yet. A project has to belong to one.")}
          </Text>
        ) : (
          <Stack gap="snug">
            {config.workspaces.map((w) => (
              <Row key={w.id} gap="none">
                <Card className="w-full">
                  <Inset pad="normal">
                    <Stack gap="snug">
                      <Row gap="snug" align="baseline" justify="between">
                        <Heading level={3} as="h3">
                          {w.id}
                        </Heading>
                        <Row gap="tight">
                          <Button tone="ghost" size="sm" onClick={() => setEditing(w)}>
                            {t("Edit")}
                          </Button>
                          <Button tone="ghost" size="sm" onClick={() => onForget(w.id)}>
                            {t("Forget")}
                          </Button>
                        </Row>
                      </Row>
                      <Row gap="tight" wrap>
                        <Badge>{exportsAs(w, t)}</Badge>
                        <Badge>{held(config, w.id, t)}</Badge>
                      </Row>
                    </Stack>
                  </Inset>
                </Card>
              </Row>
            ))}
          </Stack>
        )}
      </Section>

      <WorkspaceForm
        config={config}
        editing={editing}
        onCancel={() => setEditing(null)}
        onSubmit={(w, previous) => {
          onRegister(w, previous);
          setEditing(null);
        }}
      />
    </Stack>
  );
}

function held(config: Config, id: string, t: Translate): string {
  const n = config.projects.filter((p) => p.workspace === id).length;
  return n === 0 ? t("No projects") : t.plural(n, "{n} project", "{n} projects");
}

/// A workspace is born sealed. It rises by a deliberate act, never by
/// default and never the other way.
const BLANK: Workspace = { id: "", export: "metadata" };

function WorkspaceForm({
  config,
  editing,
  onSubmit,
  onCancel,
}: {
  config: Config;
  editing: Workspace | null;
  onSubmit: (w: Workspace, previous?: string) => void;
  onCancel: () => void;
}) {
  const t = useText();
  const [draft, setDraft] = useState<Workspace>(BLANK);

  /// Copied in once, then owned here.
  ///
  /// This read `editing ?? draft` and rendered straight from the prop, so
  /// for as long as something was being edited every keystroke wrote to a
  /// state nothing was reading. A form is a draft of a thing, not a view of
  /// it — the moment it shows a value it does not own, it stops being one.
  useEffect(() => setDraft(editing ?? BLANK), [editing]);

  const blocked = whyNot(draft.id, config, editing?.id);

  return (
    <NewThing
      title={t("New workspace")}
      blurb={t("Projects that share this name share a supervisor's reading.")}
      editing={editing?.id}
    >
      <Grid columns={2}>
        <Field
          label={t("Whose work is this?")}
          value={draft.id}
          onChange={(id) => setDraft({ ...draft, id })}
          placeholder={t("A client, or personal")}
        />
        <ChoiceField
          label={t("What its supervisors may let out")}
          value={draft.export ?? "metadata"}
          onChange={(level) => setDraft({ ...draft, export: level as Level })}
          choices={levels(t)}
        />
      </Grid>

      <Row gap="normal" wrap>
        <Button
          tone="primary"
          disabled={blocked !== null}
          onClick={() => {
            if (blocked) return;
            onSubmit({ ...draft, id: draft.id.trim() }, editing?.id);
            setDraft(BLANK);
          }}
        >
          {editing ? t("Save changes") : t("Make it")}
        </Button>
        {editing ? (
          <Button tone="ghost" onClick={onCancel}>
            {t("Cancel")}
          </Button>
        ) : null}
        {blocked ? (
          <Text tone="muted" size="sm">
            {blocked}
          </Text>
        ) : null}
      </Row>
    </NewThing>
  );
}

/// Why this workspace cannot be saved yet.
///
/// `previous` is the name it had before, when this is an edit: a workspace
/// keeping its own name is not a collision with itself.
export function whyNot(id: string, config: Config, previous?: string): string | null {
  const name = id.trim();
  if (!name) return "give it a name";
  if (name !== previous && config.workspaces.some((w) => w.id === name)) {
    return `${name} already exists`;
  }
  return null;
}
