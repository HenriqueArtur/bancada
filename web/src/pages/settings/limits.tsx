import type { Limits, Source, Stated } from "@/core/settings";
import { whereFrom } from "@/core/settings";
import { Text } from "@/components";
import { Field } from "@/composites";
import { Row, Stack } from "@/frame";
import { useText } from "@/lib/language";

/// A threshold you may decline to state.
///
/// Empty is not zero and not the default — it is *say nothing here*, which
/// is what makes inheritance possible at all. So the box stays empty and
/// what its emptiness means is written in the placeholder, rather than the
/// box being prefilled with a number nobody chose and that can no longer be
/// told apart from one they did.
export function Threshold({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | undefined;
  /// `undefined` when the box is emptied — the whole point of the control.
  onChange: (v: number | undefined) => void;
  hint?: string;
}) {
  const t = useText();
  return (
    <Field
      label={label}
      value={value === undefined ? "" : String(value)}
      placeholder={t("Inherited")}
      onChange={(raw) => {
        const trimmed = raw.trim();
        if (trimmed === "") return onChange(undefined);
        const n = Number.parseInt(trimmed, 10);
        // `Number("")` is 0, and a weight of zero erases the project from
        // the order. Selecting a field and deleting what is in it is one
        // keystroke away from every edit, so it must not state anything.
        onChange(Number.isNaN(n) ? undefined : n);
      }}
      hint={hint}
    />
  );
}

/// One project's numbers as they came out, and where each one came from.
///
/// Beside the project rather than inside the form on purpose: the form is
/// what you *told* it, and this is what that produced. A field showing the
/// resolved value would have to re-implement the order of precedence in the
/// window, and the same rule in two languages stays the same rule only
/// until one of them is edited.
export function Resolved({ limits, workspace }: { limits: Limits; workspace: string }) {
  const t = useText();
  return (
    <Stack gap="tight">
      <Line
        says={t.plural(
          limits.idleAfterMinutes.value,
          "Quiet for {n} minute",
          "Quiet for {n} minutes",
        )}
        from={limits.idleAfterMinutes.from}
        workspace={workspace}
      />
      <Line
        says={t("Weight {n}", { n: limits.weight.value })}
        from={limits.weight.from}
        workspace={workspace}
      />
    </Stack>
  );
}

function Line({ says, from, workspace }: { says: string; from: Source; workspace: string }) {
  const t = useText();
  const source = whereFrom(from, workspace, t);
  return (
    <Row gap="snug" align="baseline" wrap>
      <Text as="span" size="sm" tone="muted">
        {says}
      </Text>
      {source ? (
        <Text as="span" size="sm" tone="faint">
          {source}
        </Text>
      ) : null}
    </Row>
  );
}

/// Change one number without disturbing the others.
///
/// A helper rather than a spread at each call site: `limits` is optional on
/// both a project and a workspace, and five call sites each writing
/// `{ ...(x.limits ?? {}), … }` is five chances to drop the rest of it.
export function withLimits<T extends { limits?: Stated }>(
  thing: T,
  change: Partial<Stated>,
): T {
  return { ...thing, limits: { ...(thing.limits ?? {}), ...change } };
}
