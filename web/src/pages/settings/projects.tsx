import { open as pickFolder } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { FolderOpenIcon } from "@phosphor-icons/react";
import type { Config, Project } from "@/core/settings";
import { THIS_MACHINE, evidenceOf, logDirName, whyNot } from "@/core/settings";
import { Badge, Button, Card, Mono, Table, TableBody, TableCell, TableRow, Text } from "@/components";
import { ChoiceField, Field, Notice } from "@/composites";
import { Full, Grid, Inset, Row, Stack } from "@/frame";
import { Disclosure } from "@/components";
import { useDraftProject } from "@/pages/settings/logic";

export function ProjectsPanel({
  config,
  onRegister,
  onForget,
}: {
  config: Config;
  onRegister: (p: Project) => void;
  onForget: (id: string) => void;
}) {
  return (
    <Stack gap="loose">
      <Registered config={config} onForget={onForget} />
      <AddProject config={config} onRegister={onRegister} />
    </Stack>
  );
}

function Registered({ config, onForget }: { config: Config; onForget: (id: string) => void }) {
  if (config.projects.length === 0) {
    return (
      <Text tone="muted" size="sm">
        Nothing registered yet.
      </Text>
    );
  }
  return (
    <Table>
      <TableBody>
        {config.projects.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.id}</TableCell>
            <TableCell>
              <Mono>{p.path}</Mono>
            </TableCell>
            <TableCell>
              <Text as="span" size="sm" tone="muted">
                {p.runtime === THIS_MACHINE ? "This machine" : p.runtime}
              </Text>
            </TableCell>
            <TableCell className="w-0">
              <Badge title="How fast waiting hurts here">×{p.weight}</Badge>
            </TableCell>
            <TableCell className="w-0">
              <Button tone="ghost" size="sm" onClick={() => onForget(p.id)}>
                Forget
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/// Pick a folder, and be shown what watching it would mean.
///
/// The confirmation is evidence — *four sessions already recorded here* —
/// rather than the encoded directory name this used to print. That was
/// jargon asking a person to verify what the product can verify itself.
function AddProject({
  config,
  onRegister,
}: {
  config: Config;
  onRegister: (p: Project) => void;
}) {
  const { draft, setDraft, setPath, preview, clear } = useDraftProject();
  const [picking, setPicking] = useState(false);

  const local = draft.runtime === THIS_MACHINE;
  const blocked = whyNot(draft, config);
  const evidence = evidenceOf(preview);

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
    <Card>
      <Inset pad="loose">
        <Stack gap="normal">
          <Grid columns={2}>
            <Full>
              <Field
                label="Where does it live?"
                value={draft.path}
                onChange={setPath}
                placeholder={local ? "/Users/you/dev/thing" : "The path as the guest spells it"}
                after={
                  // Only for this machine. A guest path cannot be browsed
                  // from here, and a picker that quietly returned the host's
                  // spelling of it would register something that does not
                  // exist.
                  local ? (
                    <Button tone="outline" onClick={browse} disabled={picking} type="button">
                      <FolderOpenIcon size={15} />
                      {picking ? "…" : "Browse"}
                    </Button>
                  ) : undefined
                }
              />
            </Full>

            {evidence ? (
              <Full>
                <Notice tone={evidence.tone}>
                  {evidence.says}
                  {preview && preview.reachable && !preview.versioned
                    ? " · Not a git repository, so there will be no diff to review."
                    : ""}
                </Notice>
              </Full>
            ) : null}

            <Field
              label="Call it"
              value={draft.id}
              onChange={(id) => setDraft({ ...draft, id })}
              placeholder="From the folder name"
            />
            <ChoiceField
              label="Runs on"
              value={draft.runtime}
              onChange={(runtime) => setDraft({ ...draft, runtime })}
              choices={config.runtimes.map((r) => ({
                value: r.id,
                label: r.id === THIS_MACHINE ? "This machine" : r.id,
              }))}
            />

            <Full>
              <Disclosure summary="Whose it is, and how fast waiting hurts">
                <Grid columns={2}>
                  <ChoiceField
                    label="Workspace"
                    value={draft.workspace}
                    onChange={(workspace) => setDraft({ ...draft, workspace })}
                    choices={config.workspaces.map((w) => ({ value: w.id, label: w.id }))}
                  />
                  <Field
                    label="Weight"
                    value={String(draft.weight)}
                    onChange={(v) => setDraft({ ...draft, weight: Number(v) || 1 })}
                    hint="Scales how fast waiting hurts. Never overrides the kind of decision."
                  />
                  <Field
                    label="Quiet for (minutes) before it counts"
                    value={String(draft.idleAfterMinutes)}
                    onChange={(v) => setDraft({ ...draft, idleAfterMinutes: Number(v) || 1 })}
                  />
                  {draft.path ? (
                    <Stack gap="tight" justify="end">
                      <Text size="sm" tone="faint">
                        Logs
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
                  onRegister(draft);
                  clear();
                }
              }}
            >
              Watch it
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
