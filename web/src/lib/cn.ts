import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/// Join class names, letting the last one win.
///
/// `clsx` flattens the conditionals; `twMerge` resolves the collisions
/// Tailwind cannot — `px-4` and `px-6` on one element is a coin toss decided
/// by stylesheet order, which is not a place to keep a design decision.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
