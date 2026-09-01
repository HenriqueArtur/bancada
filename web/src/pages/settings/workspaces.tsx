import { useState } from "react";
import type { Config, Workspace } from "@/core/settings";
import { exportsAs } from "@/core/work";
import { Badge, Button, Card, Heading, Text } from "@/components";
import { ChoiceField, Field, NewThing, Notice, Section } from "@/composites";
import { Grid, Inset, Row, Stack } from "@/frame";

const LEVELS = [
  { value: "metadata", label: "Sealed · metadata only" },
  { value: "summary", label: "Exports summaries" },
  { value: "full", label: "Exports everything" },
];

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
  const [editing, setEditing] = useState<Workspace | null>(null);

  return (
    <Stack gap="loose">
      {failed ? <Notice tone="missing">{failed}</Notice> : null}

      <Section title="Registered">
        {config.workspaces.length === 0 ? (
          <Text tone="muted" size="sm">
            None yet. A project has to belong to one.
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
                            Edit
                          </Button>
                          <Button tone="ghost" size="sm" onClick={() => onForget(w.id)}>
                            Forget
                          </Button>
                        </Row>
                      </Row>
                      <Row gap="tight" wrap>
                        <Badge>{exportsAs(w)}</Badge>
                        <Badge>{held(config, w.id)}</Badge>
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

function held(config: Config, id: string): string {
  const n = config.projects.filter((p) => p.workspace === id).length;
  return n === 0 ? "No projects" : `${n} project${n === 1 ? "" : "s"}`;
}

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
  const [draft, setDraft] = useState<Workspace>({ id: "", export: "metadata" });
  const current = editing ?? draft;
  const blocked = whyNot(current.id, config, editing?.id);

  const set = (next: Workspace) => {
    if (editing) onSubmit(next, editing.id);
    else setDraft(next);
  };

  return (
    <NewThing
      title="New workspace"
      blurb="Projects that share this name share a supervisor's reading."
      editing={editing?.id}
    >
      <Grid columns={2}>
        <Field
          label="Whose work is this?"
          value={current.id}
          onChange={(id) => (editing ? setDraft({ ...current, id }) : setDraft({ ...draft, id }))}
          placeholder="A client, or personal"
        />
        <ChoiceField
          label="What its supervisors may let out"
          value={current.export ?? "metadata"}
          onChange={(level) => set({ ...current, export: level as Level })}
          choices={LEVELS}
        />
      </Grid>

      <Row gap="normal" wrap>
        <Button
          tone="primary"
          disabled={blocked !== null}
          onClick={() => {
            if (blocked) return;
            // Born sealed. A workspace rises by a deliberate act, never by
            // default and never the other way.
            onSubmit({ ...current, export: current.export ?? "metadata" }, editing?.id);
            setDraft({ id: "", export: "metadata" });
          }}
        >
          {editing ? "Save changes" : "Make it"}
        </Button>
        {editing ? (
          <Button tone="ghost" onClick={onCancel}>
            Cancel
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
