import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tally } from "@/pages/_shared/tally";

describe("Tally", () => {
  it("counts the files and both directions", () => {
    render(<Tally summary={{ files: 12, added: 340, removed: 71, versioned: true }} />);
    expect(screen.getByText("12 changed files")).toBeTruthy();
    expect(screen.getByText("+340")).toBeTruthy();
    expect(screen.getByText("−71")).toBeTruthy();
  });

  it("counts one file as a file", () => {
    render(<Tally summary={{ files: 1, added: 3, removed: 0, versioned: true }} />);
    expect(screen.getByText("1 changed file")).toBeTruthy();
  });

  it("says the tree is clean rather than showing three zeroes", () => {
    // "0 changed files +0 −0" is four numbers to read one fact.
    render(<Tally summary={{ files: 0, added: 0, removed: 0, versioned: true }} />);
    expect(screen.getByText("Nothing uncommitted.")).toBeTruthy();
    expect(screen.queryByText("+0")).toBeNull();
  });

  it("says it is still counting rather than claiming nothing moved", () => {
    render(<Tally summary={null} />);
    expect(screen.getByText("Counting what changed…")).toBeTruthy();
  });
  it("does not claim a clean repository where there is none", () => {
    // "Nothing uncommitted" is a claim about a repository, and plenty of
    // projects are a folder somebody is working in.
    render(<Tally summary={{ files: 0, added: 0, removed: 0, versioned: false }} />);
    expect(screen.getByText("Not a git repository.")).toBeTruthy();
  });
});
