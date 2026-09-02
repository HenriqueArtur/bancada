import { useState } from "react";
import { BinocularsIcon } from "@phosphor-icons/react";
import type { Config, Discovery, RuntimeSpec } from "@/core/settings";
import { BLANK_RUNTIME, THIS_MACHINE, whyNotRuntime } from "@/core/settings";
import { Badge, Button, Card, Disclosure, Heading, Mono, Text } from "@/components";
import { ChoiceField, Field, ToggleField } from "@/composites";
import { Grid, Inset, Row, Stack } from "@/frame";
import { useDiscovery } from "@/pages/settings/logic";
import { useText } from "@/lib/language";

export function MachinesPanel({
  config,
  onRegister,
}: {
  config: Config;
  onRegister: (r: RuntimeSpec) => void;
}) {
  const t = useText();
  const { found, probing, probe } = useDiscovery();

  return (
    <Stack gap="loose">
      <Stack gap="snug">
        {config.runtimes.map((r) => (
          <Card key={r.id}>
            <Inset pad="normal">
              <Stack gap="snug">
                <Row gap="snug" align="baseline" justify="between">
                  <Heading level={3} as="h3">
                    {r.id === THIS_MACHINE ? t("This machine") : r.id}
                  </Heading>
                  {r.id === THIS_MACHINE ? (
                    // Not a proposal and not a declaration: the product is
                    // already executing here, so there is nothing to be
                    // wrong about and nothing to register.
                    <Badge>{t("Always here")}</Badge>
                  ) : (
                    <Badge>{r.kind}</Badge>
                  )}
                </Row>

                <Mono className="break-all leading-relaxed">
                  {r.prefix.join(" ") || t("No prefix — commands run directly")}
                </Mono>

                <Probed d={found.get(r.id)} />
              </Stack>
            </Inset>
          </Card>
        ))}

        <Row gap="normal" wrap>
          <Button tone="outline" onClick={probe} disabled={probing}>
            <BinocularsIcon size={15} />
            {probing ? t("Checking…") : t("Check every machine")}
          </Button>
          <Text tone="muted" size="sm">
            {t(
              "Looks for a harness on each one and reports its version and whether it is signed in. It registers nothing.",
            )}
          </Text>
        </Row>
      </Stack>

      <AddRuntime config={config} onRegister={onRegister} />
    </Stack>
  );
}

/// What one machine turned out to have, once it was asked.
function Probed({ d }: { d?: Discovery }) {
  const t = useText();
  if (!d) return null;
  if (d.error) {
    return (
      <Text as="span" size="sm" tone="alarm">
        {d.error}
      </Text>
    );
  }
  if (!d.harness) {
    return (
      <Text as="span" size="sm" tone="muted">
        {t("No harness there")}
      </Text>
    );
  }
  const who = d.harness.account;
  return (
    <Text as="span" size="sm" tone="muted">
      {d.harness.version}
      {d.harness.loggedIn ? "" : ` · ${t("logged out")}`}
      {who ? ` · ${who.email}` : ""}
    </Text>
  );
}

/// A VM, a container or a host over ssh, described once.
///
/// Folded away until asked for. Most people register a runtime a handful of
/// times ever, and a six-field form sitting open makes the common case look
/// as hard as the rare one.
function AddRuntime({
  config,
  onRegister,
}: {
  config: Config;
  onRegister: (r: RuntimeSpec) => void;
}) {
  const t = useText();
  const [draft, setDraft] = useState<RuntimeSpec>(BLANK_RUNTIME);
  const blocked = whyNotRuntime(draft, config, t);

  return (
    <Card>
      <Inset pad="loose">
        <Disclosure summary={t("Add a machine")}>
          <Stack gap="normal">
            <Grid columns={2}>
              <Field
                label={t("Name")}
                value={draft.id}
                onChange={(id) => setDraft({ ...draft, id })}
              />
              <ChoiceField
                label={t("Kind")}
                value={draft.kind}
                onChange={(kind) => setDraft({ ...draft, kind })}
                choices={["vm", "container", "ssh", "local"].map((v) => ({
                  value: v,
                  label: v,
                }))}
              />
              <Field
                label={t("Command prefix")}
                value={draft.prefix.join(" ")}
                onChange={(v) => setDraft({ ...draft, prefix: v.split(/\s+/).filter(Boolean) })}
                hint={t(
                  "What goes in front of everything bancada runs there. Use absolute paths — this window does not inherit your shell's PATH.",
                )}
              />
              <Field
                label={t("The harness's state folder")}
                value={draft.configDir}
                onChange={(configDir) => setDraft({ ...draft, configDir })}
                hint={t(
                  "Where its sessions are written, as this machine spells it. When the harness runs elsewhere, this is wherever that folder is reachable from here.",
                )}
              />
              <Field
                label={t("The folder you share with it")}
                value={draft.hostRoot}
                onChange={(hostRoot) => setDraft({ ...draft, hostRoot })}
                hint={t("As this machine spells it.")}
              />
              {/* The label names the machine you have just named. The "it"
                  with no antecedent is not reworded — it stops existing,
                  because the thing it referred to is on the screen. */}
              <Field
                label={t("The same folder, as {name} spells it", {
                  name: draft.id.trim() || t("that machine"),
                })}
                value={draft.guestRoot}
                onChange={(guestRoot) => setDraft({ ...draft, guestRoot })}
                hint={t("Where it appears from inside.")}
              />
              {/* Declared, not probed. The probe reads a version off the
                  binary; only you know which model you have it pointed at,
                  and a header right about the half nobody asked about is
                  worse than one that stays quiet. */}
              <Field
                label={t("The harness")}
                value={draft.harness ?? ""}
                onChange={(v) => setDraft({ ...draft, harness: v.trim() || null })}
                hint={t("Which one runs there. Shown in the header of every project on it.")}
              />
              <Field
                label={t("The model")}
                value={draft.model ?? ""}
                onChange={(v) => setDraft({ ...draft, model: v.trim() || null })}
                hint={t("What you have it pointed at, spelled however you say it.")}
              />
            </Grid>
            <ToggleField
              label={t("It shares this machine's filesystem")}
              on={draft.sharedFs}
              onChange={(sharedFs) => setDraft({ ...draft, sharedFs })}
              hint={t(
                "On when the folder above is a real mount, so files are read directly instead of through a command. Faster, and true of most VM and container mounts.",
              )}
            />
            <Row gap="normal" wrap>
              <Button
                tone="primary"
                disabled={blocked !== null}
                onClick={() => {
                  if (!blocked) {
                    onRegister(draft);
                    setDraft(BLANK_RUNTIME);
                  }
                }}
              >
                {t("Add it")}
              </Button>
              {blocked ? (
                <Text tone="muted" size="sm">
                  {blocked}
                </Text>
              ) : null}
            </Row>
          </Stack>
        </Disclosure>
      </Inset>
    </Card>
  );
}
