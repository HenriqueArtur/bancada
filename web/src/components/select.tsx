import * as Primitive from "@radix-ui/react-select";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Choice {
  value: string;
  label: string;
}

/// Choose one of a known set.
///
/// A native `<select>` cannot be styled to match this palette on macOS, and
/// a control that ignores the theme is the one thing on the screen that
/// looks like somebody else's program.
export function Select({
  value,
  onChange,
  choices,
  placeholder = "—",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  choices: Choice[];
  placeholder?: string;
  id?: string;
}) {
  return (
    <Primitive.Root value={value || undefined} onValueChange={onChange}>
      <Primitive.Trigger
        id={id}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg",
          "border border-line bg-ground px-3 text-sm text-ink outline-none transition-colors",
          "data-[placeholder]:text-ink-faint",
          "focus-visible:border-clay focus-visible:ring-[3px] focus-visible:ring-ring",
        )}
      >
        <Primitive.Value placeholder={placeholder} />
        <Primitive.Icon>
          <CaretDownIcon size={13} className="text-ink-faint" />
        </Primitive.Icon>
      </Primitive.Trigger>

      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          sideOffset={5}
          className={cn(
            "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
            "rounded-lg border border-line bg-raised shadow-float p-1",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <Primitive.Viewport>
            {choices.map((c) => (
              <Item key={c.value} value={c.value}>
                {c.label}
              </Item>
            ))}
          </Primitive.Viewport>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

function Item({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Primitive.Item
      value={value}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md",
        "py-1.5 pl-7 pr-3 text-sm outline-none",
        "data-[highlighted]:bg-surface data-[highlighted]:text-ink",
      )}
    >
      <span className="absolute left-2 grid place-items-center">
        <Primitive.ItemIndicator>
          <CheckIcon size={12} className="text-clay" />
        </Primitive.ItemIndicator>
      </span>
      <Primitive.ItemText>{children}</Primitive.ItemText>
    </Primitive.Item>
  );
}
