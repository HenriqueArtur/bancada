import { Text } from "@/components";
import { ago } from "@/pages/git/logic";
import { useText } from "@/lib/language";

/// How long ago, in words the catalogue can hold.
///
/// Six phrases rather than one built at runtime: `t("…")` has to see a
/// literal or the extractor cannot find it, and a phrase nobody can extract
/// is a phrase nobody can translate.
export function Since({ when, now }: { when: number; now: number }) {
  const t = useText();
  const { n, unit } = ago(when, now);
  const said = {
    year: t.plural(n, "{n} year ago", "{n} years ago"),
    month: t.plural(n, "{n} month ago", "{n} months ago"),
    day: t.plural(n, "{n} day ago", "{n} days ago"),
    hour: t.plural(n, "{n} hour ago", "{n} hours ago"),
    minute: t.plural(n, "{n} minute ago", "{n} minutes ago"),
    second: t.plural(n, "{n} second ago", "{n} seconds ago"),
  }[unit];
  return (
    <Text as="span" size="sm" tone="faint">
      {said}
    </Text>
  );
}
