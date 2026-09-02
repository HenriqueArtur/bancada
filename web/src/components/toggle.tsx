import { CheckIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/// One thing that is either on or off.
///
/// A real `<button>` with `aria-pressed` rather than a styled checkbox: the
/// box is what the platform draws and it cannot be made to match anything
/// else here, and a `<div>` with an `onClick` is unreachable by keyboard —
/// which is the bug this exists to make impossible.
export function Toggle({
  on,
  onChange,
  label,
  className,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-1 py-1 text-left text-sm",
        "outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          on ? "border-clay bg-clay text-clay-ink" : "border-line bg-ground",
        )}
      >
        {on ? <CheckIcon size={11} weight="bold" /> : null}
      </span>
      {label}
    </button>
  );
}
