import type { Language, Phrases } from "@/core/language";

/// English → the target, one entry per phrase.
///
/// **English is deliberately absent.** It is the source: a lookup that finds
/// nothing returns the key, which *is* the English, so a catalogue for it
/// would be a file mapping every sentence to itself and one more thing to
/// keep in step.
///
/// Portuguese is registered and empty. That is the honest state — the
/// machinery is finished and no translating has happened — and it is visible
/// in the interface, which says how many phrases a language covers.
const PT_BR: Phrases = {};

export const CATALOGUES: Record<Language, Phrases> = {
  en: {},
  "pt-BR": PT_BR,
};

/// How much of the interface a language actually covers.
///
/// English is complete by construction. Everything else is a count somebody
/// can watch go up, which is the only honest way to show a translation that
/// has not been done.
export function coverage(language: Language, phrases: readonly string[]): number {
  if (language === "en") return phrases.length;
  const c = CATALOGUES[language];
  return phrases.filter((p) => p in c).length;
}
