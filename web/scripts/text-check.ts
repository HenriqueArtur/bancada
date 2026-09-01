/// Prove that every phrase in the source is accounted for.
///
/// English needs no catalogue — a lookup that finds nothing returns the key
/// — so nothing here can fail for English. What it catches is the two ways a
/// translation rots: a phrase the source uses and no catalogue has, and a
/// phrase a catalogue still carries after the source stopped saying it.
///
/// A regex over the source rather than a parse. It reads `t("…")` and
/// `t.plural(n, "…", "…")` and nothing else, which is exactly the shape the
/// codebase is allowed to use — a phrase built at runtime cannot be
/// extracted by any tool and must not exist.
///
///   bun run --cwd web text:check
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUES } from "../src/core/catalogue";
import { LANGUAGES } from "../src/core/language";

const ROOT = join(import.meta.dir, "..", "src");

/// `t("…")`, `t('…')`, and both forms of `t.plural(n, "…", "…")`.
const CALL = /\bt\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g;
const PLURAL =
  /\bt\.plural\(\s*[^,]+,\s*(["'])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(["'])((?:\\.|(?!\3)[^\\])*)\3/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.spec\./.test(name) ? [path] : [];
  });
}

/// Comments out, or the doc comment explaining `t("…")` becomes a phrase.
///
/// Line comments are dropped whole rather than from the `//` onward: a `//`
/// inside a string literal is a URL, and cutting there would truncate the
/// phrase beside it.
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function phrasesIn(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(CALL)) found.push(unquote(m[2]));
  for (const m of text.matchAll(PLURAL)) found.push(unquote(m[2]), unquote(m[4]));
  return found;
}

/// Named `unquote` rather than `unescape`: the global of that name is
/// deprecated and shadowing it makes the two indistinguishable at a glance.
const unquote = (s: string) => s.replace(/\\(["'\\])/g, "$1").replace(/\\n/g, "\n");

const used = new Set(sources(ROOT).flatMap((f) => phrasesIn(code(readFileSync(f, "utf8")))));

let wrong = 0;
console.log(`${used.size} phrases in the source.\n`);

for (const language of LANGUAGES) {
  if (language === "en") {
    console.log(`  en       complete by construction — the phrase is the key`);
    continue;
  }
  const have = CATALOGUES[language];
  const missing = [...used].filter((p) => !(p in have));
  const stale = Object.keys(have).filter((p) => !used.has(p));

  const covered = used.size - missing.length;
  console.log(`  ${language.padEnd(8)} ${covered}/${used.size} translated`);

  // Missing is not a failure. A language is allowed to be half done, and
  // every phrase it lacks falls back to English in place.
  if (stale.length > 0) {
    wrong += stale.length;
    console.log(`\n  ${stale.length} phrase(s) no longer in the source:`);
    for (const p of stale) console.log(`    ${JSON.stringify(p)}`);
  }
}

if (wrong > 0) {
  console.log(`\nA catalogue carrying a phrase the source stopped saying is a`);
  console.log(`translation of something nobody reads, and it hides the fact that`);
  console.log(`whatever replaced it is untranslated. Remove them, or restore the`);
  console.log(`phrase.`);
  process.exit(1);
}
