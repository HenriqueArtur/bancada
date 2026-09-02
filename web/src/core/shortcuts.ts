/// Every keystroke the window answers to, in one place.
///
/// A registry rather than a listener per feature. The zoom shipped with its
/// own `keydown` handler inside the shell, and the second one hung beside it
/// is how a window ends up with two keys doing the same thing and nowhere to
/// look them up.
import type { Translate } from "@/core/language";

export const ACTIONS = [
  "chat",
  "zoom.in",
  "zoom.out",
  "zoom.reset",
  "tab.next",
  "tab.previous",
] as const;

export type Action = (typeof ACTIONS)[number];

/// A keystroke, spelled one way.
///
/// `mod` rather than `cmd` or `ctrl`: one binding serves both machines, and
/// a product that made you rebind everything on the other one would be two
/// products.
export type Chord = string;

export const DEFAULTS: Record<Action, Chord> = {
  chat: "mod+b",
  "zoom.in": "mod+=",
  "zoom.out": "mod+-",
  "zoom.reset": "mod+0",
  "tab.next": "mod+shift+]",
  "tab.previous": "mod+shift+[",
};

/// What each one does, in words. A function of `t` because a phrase has to
/// reach `t("…")` as a literal to be extractable.
export function nameOf(action: Action, t: Translate): string {
  switch (action) {
    case "chat":
      return t("Show or hide the conversation");
    case "zoom.in":
      return t("Bigger");
    case "zoom.out":
      return t("Smaller");
    case "zoom.reset":
      return t("Back to 100%");
    case "tab.next":
      return t("Next screen in this project");
    default:
      return t("Previous screen in this project");
  }
}

/// How a keystroke spells itself, or `null` for one that is not a shortcut.
///
/// A bare modifier is not a chord — held down on the way to a real key, it
/// would otherwise fire something on its own. Neither is an unmodified key:
/// typing a `-` into the filter box must not shrink the window.
export function chord(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): Chord | null {
  if (!e.metaKey && !e.ctrlKey) return null;
  if (["Meta", "Control", "Shift", "Alt"].includes(e.key)) return null;

  const parts = ["mod"];
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  // Lowercased because shift already appears above: without it, `mod+shift+K`
  // and `mod+shift+k` are two chords for one keystroke.
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

export function matches(
  keys: Record<Action, Chord>,
  e: Parameters<typeof chord>[0],
): Action | null {
  const said = chord(e);
  if (!said) return null;
  return (ACTIONS.find((a) => keys[a] === said) as Action) ?? null;
}

export function bound(keys: Record<Action, Chord>, action: Action): Chord {
  return keys[action];
}

/// Who already answers to this keystroke, if anybody but `action` does.
export function clash(
  keys: Record<Action, Chord>,
  action: Action,
  wanted: Chord,
): Action | null {
  return (ACTIONS.find((a) => a !== action && keys[a] === wanted) as Action) ?? null;
}

const KEY = "bancada.shortcuts";

/// Kept in the webview like the palette and the size.
///
/// `config.json` is the product's declaration of what it watches. Which key
/// does what belongs to whoever is typing on this machine, and a shared
/// configuration carrying it would rebind somebody else's keyboard.
export function stored(): Record<Action, Chord> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (typeof raw !== "object" || raw === null) return { ...DEFAULTS };
    // Read through the action list rather than over the stored keys: a
    // binding left behind by a build that removed its action is not a
    // shortcut any more, and carrying it forward would hold a key hostage.
    const out = { ...DEFAULTS };
    for (const a of ACTIONS) {
      const said = (raw as Record<string, unknown>)[a];
      if (typeof said === "string" && said !== "") out[a] = said;
    }
    return out;
  } catch {
    // A window that cannot remember still has to answer to its keys.
    return { ...DEFAULTS };
  }
}

function write(keys: Record<Action, Chord>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* see `stored` */
  }
}

export function rebind(action: Action, wanted: Chord): Record<Action, Chord> {
  const keys = { ...stored(), [action]: wanted };
  write(keys);
  return keys;
}

export function forget(action: Action): Record<Action, Chord> {
  const keys = { ...stored(), [action]: DEFAULTS[action] };
  write(keys);
  return keys;
}

/// A chord as a person reads it: `⌘⇧B` on a Mac, `Ctrl+Shift+B` elsewhere.
export function spell(said: Chord, apple: boolean): string {
  const parts = said.split("+");
  const key = parts[parts.length - 1];
  const held = parts.slice(0, -1);
  const shown = held.map((h) =>
    apple
      ? ({ mod: "⌘", shift: "⇧", alt: "⌥" }[h] ?? h)
      : ({ mod: "Ctrl", shift: "Shift", alt: "Alt" }[h] ?? h),
  );
  const named = key.length === 1 ? key.toUpperCase() : key;
  return apple ? [...shown, named].join("") : [...shown, named].join("+");
}
