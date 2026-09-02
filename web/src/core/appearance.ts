import type { Translate } from "@/core/language";

/// Which palette the window wears.
///
/// Three states, not two. "Dark" and "light" are choices; *following the
/// system* is the third and it is the default, because a desktop app that
/// ignores the machine's own setting is one more thing to keep in step by
/// hand.
export type Theme = "system" | "light" | "dark";

export const THEMES: Theme[] = ["system", "light", "dark"];

const KEY = "bancada.theme";

/// Kept in the webview, not in the configuration.
///
/// `config.json` is the product's declaration of what it watches — projects,
/// machines, boundaries. A palette is a fact about the person reading, not
/// about the work, and mixing the two would put a preference somewhere a
/// backup or a shared configuration would carry it.
export function stored(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    return THEMES.includes(raw as Theme) ? (raw as Theme) : "system";
  } catch {
    // A window that cannot remember still has to open.
    return "system";
  }
}

export function remember(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* see `stored` */
  }
}

/// Whether the machine is currently in the dark.
export function systemIsDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/// What a choice resolves to right now.
export function resolve(theme: Theme, systemDark: boolean): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemDark;
}

/// Put the resolved palette on the document.
///
/// One writer, and everything else reads the class. Two independent readings
/// of "is it dark" is how a light page ends up holding a dark editor, which
/// this product has already done once.
export function apply(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
}

export function nameOf(theme: Theme, t: Translate): string {
  switch (theme) {
    case "light":
      return t("Light");
    case "dark":
      return t("Dark");
    default:
      return t("Follow the system");
  }
}

/// Which edge the conversation sits on.
///
/// Beside the palette and the size, because it is the same question: how the
/// window looks while you read in it. Kept in the webview for the same
/// reason too — it is a fact about whoever is reading, not about the work.
export type Side = "left" | "right";

const SIDE_KEY = "bancada.chat-side";

export function side(): Side {
  try {
    return localStorage.getItem(SIDE_KEY) === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}

export function rememberSide(where: Side): void {
  try {
    localStorage.setItem(SIDE_KEY, where);
  } catch {
    /* see `stored` */
  }
}

/// How wide the conversation is, in pixels.
///
/// Kept, and clamped on the way in and out. A width read back from a window
/// that was 2400 pixels wide would, on a laptop, leave the screen it sits
/// beside with nothing.
export const NARROWEST = 340;
export const WIDEST = 720;

const WIDTH_KEY = "bancada.chat-width";

export function clampWidth(px: number): number {
  return Math.min(WIDEST, Math.max(NARROWEST, Math.round(px)));
}

export function width(): number {
  try {
    const said = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(said) && said > 0 ? clampWidth(said) : NARROWEST;
  } catch {
    return NARROWEST;
  }
}

export function rememberWidth(px: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(clampWidth(px)));
  } catch {
    /* see `stored` */
  }
}
