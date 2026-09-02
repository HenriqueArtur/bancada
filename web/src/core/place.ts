/// Where you were when the window closed.
///
/// Kept in the webview beside the palette, the zoom and the conversation's
/// width, and for the same reason: it is a fact about this window on this
/// machine, not about the work. The size and the position of the window
/// itself are the shell's business — only what is *inside* it is here.
export const INSIDE = ["sessions", "changes", "files", "git"] as const;
export const OUTSIDE = ["cockpit", "work"] as const;

export type Inside = (typeof INSIDE)[number];
export type Origin = (typeof OUTSIDE)[number];

/// Spelled through the list rather than as `{ at: Origin }`, so that one
/// member exists per screen. As a single member with a union inside it,
/// ruling out "cockpit" and then "work" leaves a member TypeScript will not
/// reduce away — and every `where.project` after those two checks is an
/// error about a property that is provably there.
export type Place = { [K in Origin]: { at: K } }[Origin] | { at: Inside; project: string };

export interface Kept {
  place: Place;
  /// Whether the conversation was showing. Its own field rather than part of
  /// the place: it is true of the window, not of the screen, which is the
  /// whole point of a panel that survives changing tab.
  chat: boolean;
}

export const NOWHERE: Kept = { place: { at: "cockpit" }, chat: false };

const KEY = "bancada.place";

/// What was kept, if it still makes sense.
///
/// `known` is the projects the configuration currently has. A place is only
/// restored into a project that is still registered — reopening onto a diff
/// of something you removed last week would be a window whose first act is
/// an error about a name you no longer recognise.
export function recall(known: readonly string[]): Kept {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return NOWHERE;
    const said = raw as Record<string, unknown>;
    const chat = said.chat === true;
    const place = said.place as Record<string, unknown> | undefined;
    if (!place) return NOWHERE;

    const at = place.at;
    if (OUTSIDE.includes(at as Origin)) return { place: { at: at as Origin }, chat };
    if (!INSIDE.includes(at as Inside)) return NOWHERE;

    const project = place.project;
    if (typeof project !== "string" || !known.includes(project)) return { ...NOWHERE, chat };
    return { place: { at: at as Inside, project }, chat };
  } catch {
    // A window that cannot remember still has to open somewhere.
    return NOWHERE;
  }
}

export function remember(kept: Kept): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    /* see `recall` */
  }
}
