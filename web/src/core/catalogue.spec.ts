import { describe, expect, it } from "vitest";
import { CATALOGUES, coverage } from "@/core/catalogue";
import { LANGUAGES } from "@/core/language";

describe("CATALOGUES", () => {
  it("has an entry for every language the selector offers", () => {
    // A language in the list with no catalogue would resolve to `undefined`
    // and take the whole interface down on selection.
    for (const l of LANGUAGES) expect(CATALOGUES[l]).toBeDefined();
  });

  it("leaves English empty on purpose", () => {
    // It is the source. A catalogue for it would map every sentence to
    // itself and be one more thing to keep in step.
    expect(CATALOGUES.en).toEqual({});
  });
});

describe("coverage", () => {
  const phrases = ["Needs you", "Your work", "Files"];

  it("counts English as complete without looking", () => {
    expect(coverage("en", phrases)).toBe(3);
  });

  it("counts what a language actually has", () => {
    // Portuguese ships empty and registered, which is the honest state:
    // the machinery is finished and no translating has happened.
    expect(coverage("pt-BR", phrases)).toBe(0);
  });
});
