import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Track } from "@/core/review";
import { nameOfTrack, toneOf, TrackMark } from "@/pages/files/track";

const EVERY: Track[] = [
  "modified",
  "added",
  "untracked",
  "deleted",
  "renamed",
  "conflicted",
  "ignored",
];
const t = ((s: string) => s) as never;

describe("toneOf", () => {
  it("gives every state a colour", () => {
    for (const s of EVERY) expect(toneOf(s)).not.toBe("");
  });

  it("gives an untracked path the same green as an added one", () => {
    // The editor's convention: both are "not in the last commit", and a
    // third colour for the difference is a distinction the tree cannot
    // carry.
    expect(toneOf("untracked")).toBe(toneOf("added"));
  });

  it("gives nothing at all for a path git said nothing about", () => {
    expect(toneOf(null)).toBe("");
  });
});

describe("nameOfTrack", () => {
  it("names every state in words", () => {
    expect(EVERY.map((s) => nameOfTrack(s, t))).toEqual([
      "Modified",
      "Added",
      "Untracked",
      "Deleted",
      "Renamed",
      "Conflicted",
      "Ignored",
    ]);
  });
});

describe("TrackMark", () => {
  it("marks each state with the letter the editor uses", () => {
    const letters = EVERY.filter((s) => s !== "ignored").map((s) => {
      const { container } = render(<TrackMark track={s} title={s} />);
      return container.textContent;
    });
    expect(letters).toEqual(["M", "A", "U", "D", "R", "C"]);
  });

  it("says nothing for an ignored path", () => {
    // It is already grey. A badge would hand the row it dims the loudest
    // mark in the column.
    const { container } = render(<TrackMark track="ignored" title="Ignored" />);
    expect(container.textContent).toBe("");
  });

  it("names the state for anybody who cannot read the colour", () => {
    render(<TrackMark track="modified" title="Modified" />);
    expect(screen.getByTitle("Modified")).toBeTruthy();
  });
});
