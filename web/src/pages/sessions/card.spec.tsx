import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Session } from "@/core/sessions";
import { SessionCard } from "@/pages/sessions/card";

const NOW = Date.now();
const session = (over: Partial<Session> = {}): Session => ({
  id: "3f8a21c9-aaaa-bbbb-cccc-dddddddddddd",
  title: "Extract the parser into the core",
  asked: null,
  said: "Done — the tests pass.",
  heard: "carry on",
  at: NOW - 3 * 60_000,
  waiting: false,
  ...over,
});

const asked = {
  header: "Index",
  prompt: "Which index?",
  multi: false,
  options: [
    { label: "A tree", description: "grouped by path", preview: null },
    { label: "A flat list", description: "ordered by urgency", preview: "z.rs\na.rs" },
  ],
};

describe("SessionCard", () => {
  it("names the session by what it was asked to do", () => {
    // The id is eight characters of hex. It tells you which row you are on
    // and nothing about what is in it.
    render(<SessionCard session={session()} now={NOW} />);
    expect(screen.getByText("Extract the parser into the core")).toBeTruthy();
    expect(screen.getByText("3f8a21c9")).toBeTruthy();
  });

  it("says how long ago anything last happened", () => {
    render(<SessionCard session={session()} now={NOW} />);
    expect(screen.getByText("3 minutes ago")).toBeTruthy();
  });

  it("marks the one that is stopped on you", () => {
    render(<SessionCard session={session({ waiting: true })} now={NOW} />);
    expect(screen.getByText("Waiting on you")).toBeTruthy();
  });

  it("shows the last exchange, both halves", () => {
    render(<SessionCard session={session()} now={NOW} />);
    expect(screen.getByText(/carry on/)).toBeTruthy();
    expect(screen.getByText(/Done — the tests pass/)).toBeTruthy();
  });

  it("draws a pending question as the options it already is", () => {
    render(<SessionCard session={session({ asked, waiting: true })} now={NOW} />);
    expect(screen.getByText("Which index?")).toBeTruthy();
    expect(screen.getByText("A tree")).toBeTruthy();
    expect(screen.getByText("grouped by path")).toBeTruthy();
  });

  it("says where the answer goes, because it cannot take one yet", () => {
    // Cards you cannot pick are a promise the screen does not keep. Naming
    // the terminal is the difference between a control and a picture.
    render(<SessionCard session={session({ asked, waiting: true })} now={NOW} />);
    expect(screen.getByText(/Answer it in the terminal/)).toBeTruthy();
  });

  it("shows an option's preview when it has one", () => {
    render(<SessionCard session={session({ asked, waiting: true })} now={NOW} />);
    expect(screen.getByText(/z.rs/)).toBeTruthy();
  });

  it("prefers the question to the prose when both are there", () => {
    // The prose beside a question is the harness's own preamble. The
    // question is the thing being asked.
    render(<SessionCard session={session({ asked, waiting: true })} now={NOW} />);
    expect(screen.queryByText(/Done — the tests pass/)).toBeNull();
  });

  it("names a session that has said nothing yet", () => {
    render(<SessionCard session={session({ said: null, title: null })} now={NOW} />);
    expect(screen.getByText("Nothing said yet.")).toBeTruthy();
  });
});
