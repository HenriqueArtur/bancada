import { TranslateIcon } from "@phosphor-icons/react";
import { CATALOGUES, coverage } from "@/core/catalogue";
import { ENDONYM, LANGUAGES, type Language } from "@/core/language";
import { Badge, Card, Heading, RowButton, Text } from "@/components";
import { Section } from "@/composites";
import { Divider, Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

/// Which language the interface speaks.
///
/// The names are never translated. Somebody looking for their own language
/// looks for the word they use for it, and "Portuguese" on a Brazilian
/// machine is a list they have to read in a language they came here to leave.
export function LanguagePanel({
  language,
  onChoose,
}: {
  language: Language | null;
  onChoose: (l: Language | null) => void;
}) {
  const t = useText();
  // Every phrase any catalogue knows about. English's own count is the
  // number of phrases in the source, which nothing at runtime can see — so
  // the denominator is what the catalogues cover between them.
  const known = [...new Set(Object.values(CATALOGUES).flatMap((c) => Object.keys(c)))];

  return (
    <Section title={t("Language")}>
      <Card>
        <Choice
          label={t("Follow the system")}
          detail={t("Whatever this machine asks for, falling back to English.")}
          selected={language === null}
          onChoose={() => onChoose(null)}
        />
        {LANGUAGES.map((l) => (
          <Stack gap="none" key={l}>
            <Divider soft />
            <Choice
              label={ENDONYM[l]}
              detail={
                l === "en"
                  ? t("The source. Every phrase is written in it.")
                  : t("{done} of {all} phrases translated", {
                      done: coverage(l, known),
                      all: known.length,
                    })
              }
              selected={language === l}
              onChoose={() => onChoose(l)}
              partial={l !== "en" && coverage(l, known) < known.length}
            />
          </Stack>
        ))}
      </Card>
      <Text size="sm" tone="faint">
        {t(
          "Nothing is translated yet. A phrase with no translation shows in English, in place, rather than reverting the screen.",
        )}
      </Text>
    </Section>
  );
}

function Choice({
  label,
  detail,
  selected,
  partial,
  onChoose,
}: {
  label: string;
  detail: string;
  selected: boolean;
  partial?: boolean;
  onChoose: () => void;
}) {
  const t = useText();
  return (
    <RowButton
      onClick={onChoose}
      selected={selected}
      className="items-start gap-3 rounded-none px-4 py-3.5"
    >
      <Row gap="none" className="mt-0.5 shrink-0">
        <TranslateIcon size={16} />
      </Row>
      <Stack gap="tight" className="min-w-0 flex-1">
        <Row gap="snug" align="baseline">
          <Heading level={3} as="h3">
            {label}
          </Heading>
          {partial ? <Badge>{t("In progress")}</Badge> : null}
        </Row>
        <Text size="sm" tone={selected ? "clay" : "faint"}>
          {detail}
        </Text>
      </Stack>
    </RowButton>
  );
}
