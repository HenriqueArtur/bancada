import { beforeEach, describe, expect, it } from "vitest";
import { best, current, fill, remember, stored, translator } from "@/core/language";

describe("translator", () => {
  it("returns the phrase when nothing translates it", () => {
    // Which is why English needs no catalogue and can never be incomplete.
    expect(translator({})("Nothing needs you.")).toBe("Nothing needs you.");
  });

  it("returns the translation when there is one", () => {
    const t = translator({ "Nothing needs you.": "Nada precisa de você." });
    expect(t("Nothing needs you.")).toBe("Nada precisa de você.");
  });

  it("falls back phrase by phrase, not catalogue by catalogue", () => {
    // A half-translated language shows the half it has, in place, rather
    // than reverting the whole screen to English.
    const t = translator({ Files: "Arquivos" });
    expect(t("Files")).toBe("Arquivos");
    expect(t("What changed")).toBe("What changed");
  });
});

describe("fill", () => {
  it("puts the values in", () => {
    expect(fill("{n} files changed", { n: 12 })).toBe("12 files changed");
  });

  it("leaves a placeholder standing when nothing was given for it", () => {
    // A hole in a sentence is visible. An empty space is a sentence that
    // reads as finished and is not.
    expect(fill("{n} files changed", {})).toBe("{n} files changed");
  });

  it("fills the same name everywhere it appears", () => {
    expect(fill("{a} of {a}", { a: 3 })).toBe("3 of 3");
  });
});

describe("plural", () => {
  const t = translator({});

  it("picks the form and supplies the count", () => {
    expect(t.plural(1, "{n} file changed", "{n} files changed")).toBe("1 file changed");
    expect(t.plural(12, "{n} file changed", "{n} files changed")).toBe("12 files changed");
  });

  it("treats zero as many, which is what English does", () => {
    expect(t.plural(0, "{n} file changed", "{n} files changed")).toBe("0 files changed");
  });

  it("translates the form it chose", () => {
    const pt = translator({ "{n} files changed": "{n} arquivos mudaram" });
    expect(pt.plural(3, "{n} file changed", "{n} files changed")).toBe("3 arquivos mudaram");
  });
});

describe("best", () => {
  it("takes an exact match", () => {
    expect(best(["pt-BR"])).toBe("pt-BR");
  });

  it("ignores case, because the platform does not agree with itself", () => {
    expect(best(["pt-br"])).toBe("pt-BR");
  });

  it("falls to the nearest dialect rather than to English", () => {
    // Portuguese from Portugal is nearer to Brazilian Portuguese than
    // English is to either.
    expect(best(["pt-PT"])).toBe("pt-BR");
    expect(best(["pt"])).toBe("pt-BR");
  });

  it("takes the first tag it can serve, in the order the machine ranked them", () => {
    expect(best(["de", "fr", "pt-BR", "en"])).toBe("pt-BR");
  });

  it("falls to English, which is the source and always complete", () => {
    expect(best(["de-DE"])).toBe("en");
    expect(best([])).toBe("en");
  });
});

describe("what is remembered", () => {
  beforeEach(() => localStorage.clear());

  it("has no opinion until somebody chooses", () => {
    // Absent, not English: absent means *follow the machine*, and storing
    // English on first open would freeze whatever it happened to be.
    expect(stored()).toBeNull();
  });

  it("keeps a choice, and the choice beats the machine", () => {
    remember("pt-BR");
    expect(current(["en-US"])).toBe("pt-BR");
  });

  it("follows the machine while nothing has been chosen", () => {
    expect(current(["pt-BR"])).toBe("pt-BR");
  });

  it("ignores whatever else is in the store", () => {
    localStorage.setItem("bancada.language", "klingon");
    expect(current(["en-US"])).toBe("en");
  });
});
