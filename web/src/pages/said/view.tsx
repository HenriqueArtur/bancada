import { Text } from "@/components";
import { Banner, Section } from "@/composites";
import { InsideProject, type Inside } from "@/pages/_shared";
import { IntentPanel } from "@/pages/said/panel";
import { useReview } from "@/pages/review/logic";
import { useText } from "@/lib/language";

/// What each session announced before it started acting.
///
/// Its own screen rather than a strip above the diff, because it is read
/// once and referred back to, and because it is the thing every other screen
/// is checked *against* — the deviations the changes page marks are computed
/// from exactly these words.
///
/// Measured, not the full width: this is prose.
export function SaidPage(inside: Inside) {
  const t = useText();
  const { data, failed } = useReview(inside.project);

  return (
    <InsideProject {...inside} measured>
      {failed ? (
        <Banner label={t("Could not read")} tone="alarm">
          <Text as="span" size="sm" tone="alarm">
            {failed}
          </Text>
        </Banner>
      ) : !data ? (
        <Text tone="muted" size="sm">
          {t("Reading the sessions…")}
        </Text>
      ) : (
        <Section
          title={t("Before they touched anything")}
          aside={
            <Text as="span" size="sm" tone="faint">
              {t("Quoted, not summarised")}
            </Text>
          }
        >
          <IntentPanel sessions={data.sessions} />
        </Section>
      )}
    </InsideProject>
  );
}
