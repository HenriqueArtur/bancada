/// What the window calls itself.
import { getCurrentWindow } from "@tauri-apps/api/window";

/// The title, in the order a window switcher reads it.
///
/// Waiting first, project second, screen last. `⌘⇥` and Mission Control show
/// the beginning of the line and truncate the rest, so the beginning has to
/// carry what distinguishes this window from another one — and what the
/// product exists to say is how much is waiting.
///
/// The application's own name is deliberately absent: on macOS it is already
/// in the menu bar, and repeating it spends the only part of the title
/// anybody reads.
export function titleOf(waiting: number, project: string | null, screen: string): string {
  // The screen is always named, including outside a project — there it is
  // the only thing that says where you are, and dropping it left a window
  // called "2 waiting" and nothing else.
  return [waiting > 0 ? `${waiting} waiting` : null, project, screen]
    .filter(Boolean)
    .join(" · ");
}

/// Tell the window what it is showing.
///
/// Swallows its own failure. The title is a courtesy to a window switcher,
/// and a screen that refuses to render because it could not rename its
/// window has misjudged what matters — this is also the path a browser takes
/// when the probe page runs these components outside Tauri.
export function name(title: string): void {
  try {
    void getCurrentWindow().setTitle(title);
  } catch {
    // Not in a Tauri window.
  }
}
