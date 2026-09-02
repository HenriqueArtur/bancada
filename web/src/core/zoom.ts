/// How large the window draws itself.
///
/// A zoom *level* rather than a percentage, and the same one the editor
/// uses: each step is 20% larger than the last, so `+` feels the same at
/// every size. A linear scale makes the first press enormous and the tenth
/// invisible.
///
/// The bounds are where the product stops being usable rather than where
/// the maths stops working. Below −5 the 11px marks in the diff gutter are
/// gone; above 8 the 248px index holds three words.
export const CLOSEST = -5;
export const FURTHEST = 8;

const STEP = 1.2;
const KEY = "bancada.zoom";

/// Kept in the webview, not in the configuration.
///
/// `config.json` is the product's declaration of what it watches — projects,
/// machines, boundaries. How big the text is belongs to the person reading
/// on this screen, and a shared or backed-up configuration carrying it would
/// resize somebody else's window.
export function stored(): number {
  try {
    return clamp(Number(localStorage.getItem(KEY)));
  } catch {
    // A window that cannot remember still has to open.
    return 0;
  }
}

export function remember(level: number): void {
  try {
    localStorage.setItem(KEY, String(clamp(level)));
  } catch {
    /* see `stored` */
  }
}

/// Held inside the bounds, and anything that is not a number at all is no
/// zoom.
///
/// `NaN` and not merely "not finite": an infinity is a direction and clamps
/// to the end of the range like any other overshoot, but `NaN` must never
/// reach `scale`, because `1.2 ** NaN` is `NaN` and a document scaled by
/// `NaN` disappears. `Number("x")` is how it would get here.
export function clamp(level: number): number {
  if (Number.isNaN(level)) return 0;
  return Math.min(FURTHEST, Math.max(CLOSEST, Math.round(level)));
}

/// What one level multiplies the window by.
export function scale(level: number): number {
  return STEP ** clamp(level);
}

/// The percentage a person reads, rounded to something sayable.
export function percent(level: number): number {
  return Math.round(scale(level) * 100);
}

/// Put the scale on the document.
///
/// `zoom` rather than a font size. Every measurement in this product is in
/// pixels — a 248px index, an 11px gutter, a hairline border — and scaling
/// the root font would leave all of them where they were, growing the text
/// inside boxes that did not grow with it.
///
/// One writer, and everything else reads the document. Two independent
/// readings of "how large is this" is the shape of the bug that once put a
/// dark editor on a light page.
export function apply(level: number): void {
  document.documentElement.style.zoom = String(scale(level));
}

/// What a keystroke means, or `null` for one this product has no use for.
///
/// The editor's own bindings, including the ones nobody documents: `=` is
/// what the unshifted `+` key reports, and the numeric keypad sends its own
/// names. A person pressing the key with the plus printed on it expects the
/// window to grow, whichever of the three their keyboard decides to send.
export function pressed(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}): "in" | "out" | "reset" | null {
  if (!e.metaKey && !e.ctrlKey) return null;
  switch (e.key) {
    case "+":
    case "=":
      return "in";
    case "-":
    case "_":
      return "out";
    case "0":
      return "reset";
    default:
      return null;
  }
}

/// Where a keystroke takes the level from here.
///
/// Not called `after`: in a spec file beside `beforeEach` that reads as a
/// test hook, and Biome agrees loudly enough to fail the gate over it.
export function stepped(level: number, what: "in" | "out" | "reset"): number {
  if (what === "reset") return 0;
  return clamp(level + (what === "in" ? 1 : -1));
}
