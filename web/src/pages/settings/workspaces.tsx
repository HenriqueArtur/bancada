import { useState } from "react";
import type { Config, Workspace } from "@/core/settings";
import { exportsAs } from "@/core/work";
import { Badge, Button, Card, Heading, Text } from "@/components";
import { ChoiceField, Field, Notice } from "@/composites";
import { Divider, Grid, Inset, Row, Stack } from "@/frame";

/// The boundary, as a thing you can make.
///
/// A project must name a workspace, so a cockpit with none registered cannot
/// hold a project at all — and until this existed the only way out was to
/// edit the configuration file by hand, which is not a first five minutes
/// anybody should have.
export function WorkspacesPanel({
  config,
  onRegister,
  onForget,
  failed,
}: {
  config: Config;
  onRegister: (w: Workspace) => void;
  onForget: (id: string) => void;
  /// Why the last change was refused. Forgetting one that still holds work
  /// is the case, and the message names what it holds.
  failed: string | null;
}) {
  return (
    <Stack gap="loose">
      {failed ? <Notice tone="missing">{failed}</Notice> : null}
      <Registered config={config} onForget={onForget} onEdit={onRegister} />
      <AddWorkspace config={config} onRegister={onRegister} />
    </Stack>
  );
}

function Registered({
  config,
  onForget,
  onEdit,
}: {
  config: Config;
  onForget: (id: string) => void;
  onEdit: (w: Workspace) => void;
}) {
  if (config.workspaces.length === 0) {
    return (
      <Text tone="muted" size="sm">
        No workspace yet. A project has to belong to one.
      </Text>
    );
  }
  const holds = (id: string) => config.projects.filter((p) => p.workspace === id).length;

  return (
    <Card>
      {config.workspaces.map((w, i) => (
        <Stack gap="none" key={w.id}>
          {i > 0 ? <Divider soft /> : null}
          <Inset pad="normal">
            <Stack gap="snug">
              <Row gap="snug" align="baseline" justify="between">
                <Heading level={3} as="h3">
                  {w.id}
                </Heading>
                <Button tone="ghost" size="sm" onClick={() => onForget(w.id)}>
                  Forget
                </Button>
              </Row>
              <Row gap="tight" wrap>
                <Badge>{exportsAs(w)}</Badge>
                <Badge>
                  {holds(w.id)} project{holds(w.id) === 1 ? "" : "s"}
                </Badge>
              </Row>
              <ChoiceField
                label="What its supervisors may let out"
                value={w.export ?? "metadata"}
                onChange={(level) =>
                  onEdit({ ...w, export: level as NonNullable<Workspace["export"]> })
                }
                choices={LEVELS}
              />
            </Stack>
          </Inset>
        </Stack>
      ))}
    </Card>
  );
}

const LEVELS = [
  { value: "metadata", label: "Sealed · metadata only" },
  { value: "summary", label: "Exports summaries" },
  { value: "full", label: "Exports everything" },
];

function AddWorkspace({
  config,
  onRegister,
}: {
  config: Config;
  onRegister: (w: Workspace) => void;
}) {
  const [id, setId] = useState("");
  const blocked = whyNot(id, config);

  return (
    <Card>
      <Inset pad="loose">
        <Stack gap="normal">
          <Grid columns={2}>
            <Field
              label="Whose work is this?"
              value={id}
              onChange={setId}
              placeholder="A client, or personal"
              hint="Projects that share this name share a supervisor's reading."
            />
          </Grid>
          <Row gap="normal" wrap>
            <Button
              tone="primary"
              disabled={blocked !== null}
              onClick={() => {
                if (!blocked) {
                  // Born sealed. It rises by a deliberate act, never by
                  // default and never the other way.
                  onRegister({ id: id.trim(), export: "metadata" });
                  setId("");
                }
              }}
            >
              Make it
            </Button>
            {blocked ? (
              <Text tone="muted" size="sm">
                {blocked}
              </Text>
            ) : null}
          </Row>
        </Stack>
      </Inset>
    </Card>
  );
}

/// Why this workspace cannot be made yet.
export function whyNot(id: string, config: Config): string | null {
  const name = id.trim();
  if (!name) return "give it a name";
  if (config.workspaces.some((w) => w.id === name)) return `${name} already exists`;
  return null;
}
