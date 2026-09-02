import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { Status } from "@/core/review";
import { lookOf, nameOf, StatusIcon } from "@/pages/review/status";

const EVERY: Status[] = ["added", "modified", "deleted", "renamed"];
const t = ((s: string) => s) as never;

describe("lookOf", () => {
  it("gives every status a look", () => {
    // A status with no entry renders nothing at all, and a row with no icon
    // reads as a row with no change.
    for (const s of EVERY) expect(lookOf(s).icon).toBeTruthy();
  });

  it("gives each status a colour of its own", () => {
    const tones = EVERY.map((s) => lookOf(s).tone);
    expect(new Set(tones).size).toBe(EVERY.length);
  });

  it("gives each status an icon of its own", () => {
    // The shape is what carries this at 248px; two statuses sharing one
    // silhouette would leave colour doing the work alone.
    const icons = EVERY.map((s) => lookOf(s).icon);
    expect(new Set(icons).size).toBe(EVERY.length);
  });

  it("strikes through only the file that is gone", () => {
    expect(lookOf("deleted").struck).toBe(true);
    expect(EVERY.filter((s) => lookOf(s).struck)).toEqual(["deleted"]);
  });
});

describe("nameOf", () => {
  it("names each status in words", () => {
    expect(EVERY.map((s) => nameOf(s, t))).toEqual(["Added", "Modified", "Deleted", "Renamed"]);
  });
});

describe("StatusIcon", () => {
  it("renders something for every status", () => {
    for (const s of EVERY) {
      const { container } = render(<StatusIcon status={s} />);
      expect(container.querySelector("svg")).toBeTruthy();
    }
  });

  it("wears the status colour", () => {
    const { container } = render(<StatusIcon status="added" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("text-sage");
  });
});
