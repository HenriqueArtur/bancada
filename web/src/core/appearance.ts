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

export function nameOf(theme: Theme): string {
  switch (theme) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    default:
      return "Follow the system";
  }
}
