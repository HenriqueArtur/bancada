/// The interface's language, with English as the source.
///
/// **A phrase is its own key.** `t("Nothing needs you.")` looks the English
/// up in a table and, finding nothing, returns what it was given. So English
/// needs no catalogue and can never be incomplete, and the call site still
/// reads as the sentence — which matters here more than it usually would,
/// because the interface text *is* the product's voice and `t("cockpit.
/// empty.headline")` hides it.
///
/// What that costs is a completeness check the compiler cannot do, so
/// `bun run --cwd web text:check` extracts every phrase from the source and
/// diffs it against each catalogue. The tool proves it rather than anybody
/// promising.
export type Language = "en" | "pt-BR";

export const LANGUAGES: Language[] = ["en", "pt-BR"];

/// What each language calls itself. Never translated: a person looking for
/// their own language looks for the word they use for it.
export const ENDONYM: Record<Language, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};

export type Phrases = Record<string, string>;

export interface Translate {
  (phrase: string, values?: Record<string, string | number>): string;
  /// Two forms, both extractable, chosen before the lookup.
  ///
  /// Not ICU. English and Portuguese both have two, and a plural engine for
  /// a two-hundred-phrase catalogue is machinery for a problem that does not
  /// exist yet. A language with more forms needs this replaced, and that is
  /// written down rather than discovered.
  plural(
    n: number,
    one: string,
    many: string,
    values?: Record<string, string | number>,
  ): string;
}

/// Fill `{name}` from the values given.
///
/// A placeholder with no value is left standing rather than blanked: a hole
/// in a sentence is visible, and an empty space is a sentence that reads as
/// finished and is not.
export function fill(text: string, values?: Record<string, string | number>): string {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

export function translator(phrases: Phrases): Translate {
  const t = ((phrase, values) => fill(phrases[phrase] ?? phrase, values)) as Translate;
  t.plural = (n, one, many, values) => t(n === 1 ? one : many, { n, ...values });
  return t;
}

/// The best available match for what the machine asks for.
///
/// `pt-BR` matches exactly; `pt-PT` and a bare `pt` fall to `pt-BR` rather
/// than to English, because the nearest language is nearer than none. Any
/// other tag is English, which is the source and therefore always complete.
export function best(
  tags: readonly string[],
  available: readonly Language[] = LANGUAGES,
): Language {
  for (const tag of tags) {
    const exact = available.find((l) => l.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const base = tag.split("-")[0]?.toLowerCase();
    const near = available.find((l) => l.split("-")[0].toLowerCase() === base);
    if (near) return near;
  }
  return "en";
}

const KEY = "bancada.language";

/// Kept in the webview beside the palette, and for the same reason: it is a
/// fact about whoever is reading, not about the work.
export function stored(): Language | null {
  try {
    const raw = localStorage.getItem(KEY);
    return LANGUAGES.includes(raw as Language) ? (raw as Language) : null;
  } catch {
    return null;
  }
}

export function remember(language: Language): void {
  try {
    localStorage.setItem(KEY, language);
  } catch {
    /* a window that cannot remember still has to open */
  }
}

/// What was chosen, or what the machine asks for, or English.
export function current(tags: readonly string[]): Language {
  return stored() ?? best(tags);
}
