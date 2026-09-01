import { useState } from "react";
import { BinocularsIcon } from "@phosphor-icons/react";
import type { Config, Discovery, RuntimeSpec } from "@/core/settings";
import { BLANK_RUNTIME, THIS_MACHINE, whyNotRuntime } from "@/core/settings";
import { Badge, Button, Card, Disclosure, Heading, Mono, Text } from "@/components";
import { ChoiceField, Field } from "@/composites";
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
            {probing ? t("Probing…") : t("Ask them what they have")}
          </Button>
          <Text tone="muted" size="sm">
            {t("Discovery proposes; registering is yours.")}
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
        {t("No harness installed")}
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
        <Disclosure summary={t("Describe another machine")}>
          <Stack gap="normal">
            <Grid columns={2}>
              <Field
                label={t("Call it")}
                value={draft.id}
                onChange={(id) => setDraft({ ...draft, id })}
              />
              <ChoiceField
                label={t("What kind")}
                value={draft.kind}
                onChange={(kind) => setDraft({ ...draft, kind })}
                choices={["vm", "container", "ssh", "local"].map((v) => ({ value: v, label: v }))}
              />
              <Field
                label={t("What runs in front of every command")}
                value={draft.prefix.join(" ")}
                onChange={(v) => setDraft({ ...draft, prefix: v.split(/\s+/).filter(Boolean) })}
                hint={t("For a Lima VM: limactl shell devbox --")}
              />
              <Field
                label={t("Where the harness keeps state, as this machine spells it")}
                value={draft.configDir}
                onChange={(configDir) => setDraft({ ...draft, configDir })}
              />
              <Field
                label={t("Its tree, as this machine spells it")}
                value={draft.hostRoot}
                onChange={(hostRoot) => setDraft({ ...draft, hostRoot })}
              />
              <Field
                label={t("The same tree, as it spells it")}
                value={draft.guestRoot}
                onChange={(guestRoot) => setDraft({ ...draft, guestRoot })}
              />
            </Grid>
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
                {t("Register it")}
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
