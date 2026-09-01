import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/// The word that names a control, tied to it.
///
/// Its own component so a form field cannot end up with a heading floating
/// above an input: a screen reader reads those as unrelated, and clicking
/// the word does not focus the box.
export function Label({ className, ...props }: ComponentProps<"label">) {
  // biome-ignore lint/a11y/noLabelWithoutControl: the association is `htmlFor`, which every caller supplies — `Field` and `ChoiceField` generate the id and hand it to both halves, which is the whole reason those composites exist
  return <label className={cn("text-[13px] text-ink-muted", className)} {...props} />;
}
