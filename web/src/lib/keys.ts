import { useEffect, useRef } from "react";
import { matches, type Action, type Chord } from "@/core/shortcuts";

/// The window's keystrokes, hung once and read from a table.
///
/// A table rather than a chain of `if`s: adding an action to the registry
/// and forgetting to add a branch is then a type error rather than a key
/// that quietly does nothing.
export function useKeys(
  keys: Record<Action, Chord>,
  on: Partial<Record<Action, () => void>>,
): void {
  // Held in a ref so the listener is hung once. Handlers close over state and
  // are new on every render; re-hanging with them would take the listener
  // down and put it back between a key going down and coming up.
  const doing = useRef(on);
  doing.current = on;

  useEffect(() => {
    const listen = (e: KeyboardEvent) => {
      const what = matches(keys, e);
      const act = what && doing.current[what];
      if (!act) return;
      // Chromium binds the zoom keys itself and the two scales multiply,
      // with neither control able to undo the other.
      e.preventDefault();
      act();
    };
    // Captured on the way down. Monaco binds some of these for its own font
    // size and stops them before they bubble, so a listener waiting at the
    // bottom would work everywhere except inside the file being read.
    window.addEventListener("keydown", listen, true);
    return () => window.removeEventListener("keydown", listen, true);
  }, [keys]);
}
