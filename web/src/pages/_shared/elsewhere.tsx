import { Mono } from "@/components";
import { Banner } from "@/composites";
import { useText } from "@/lib/language";

/// Says out loud that this is not your cockpit.
///
/// A window reading a scratch configuration is indistinguishable from the
/// real one, and every screen here is a claim about what needs *you*. A
/// claim about somewhere else has to announce itself, or it is worse than no
/// claim at all.
///
/// Absent for the default configuration, so it costs nothing to the case
/// that matters: a warning that is always on is a warning nobody reads.
export function Elsewhere({ path }: { path: string | null }) {
  const t = useText();
  if (!path) return null;
  return (
    <Banner label={t("Not your cockpit")}>
      <Mono>{path}</Mono>
    </Banner>
  );
}
