import { useId, type ReactNode } from "react";
import { Input, Label, Select, Text, type Choice } from "@/components";
import { Row, Stack } from "@/frame";

/// A label, its control, and the thing the label could not say.
///
/// Always the three together, because a bare input with a heading above it
/// is not labelled — a screen reader reads them as unrelated, and clicking
/// the word does not focus the box.
export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  after,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  after?: ReactNode;
}) {
  const id = useId();
  const control = (
    <Input
      id={id}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  return (
    <Stack gap="tight">
      <Label htmlFor={id}>{label}</Label>
      {after ? (
        <Row gap="tight" align="stretch">
          {control}
          {after}
        </Row>
      ) : (
        control
      )}
      {hint ? (
        <Text size="sm" tone="faint">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

/// The same, choosing from a known set.
export function ChoiceField({
  label,
  value,
  onChange,
  choices,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  choices: Choice[];
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Stack gap="tight">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        value={value}
        onChange={onChange}
        choices={choices}
        placeholder={placeholder}
      />
    </Stack>
  );
}
