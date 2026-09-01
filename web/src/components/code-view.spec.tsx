import { describe, expect, it } from "vitest";
import { languageOf } from "./code-view";

describe("languageOf", () => {
  it("knows the languages this project is written in", () => {
    expect(languageOf("src/db.rs")).toBe("rust");
    expect(languageOf("web/src/app.tsx")).toBe("typescript");
  });

  it("falls back to plain text rather than guessing", () => {
    expect(languageOf("LICENSE")).toBe("plaintext");
    expect(languageOf("data.parquet")).toBe("plaintext");
  });
});
