import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Said } from "@/core/chat";
import { Talk } from "@/pages/sessions/talk";

const said = (over: Partial<Said> = {}): Said =>
  ({
    kind: "agent",
    text: "Levantei o terreno.",
    at: Date.now(),
    ...over,
  }) as Said;

const steps = (over: Partial<Extract<Said, { kind: "steps" }>> = {}): Said => ({
  kind: "steps",
  at: Date.now(),
  steps: [
    { tool: "Read", target: "src/x.rs", ok: true },
    { tool: "Bash", target: "cargo test", ok: true },
    { tool: "Bash", target: "make check", ok: false },
  ],
  ...over,
});

const show = (over: Partial<Parameters<typeof Talk>[0]> = {}) =>
  render(
    <Talk
      said={[said({ kind: "you", text: "pode seguir" }), said()]}
      more={false}
      loading={false}
      onOlder={vi.fn()}
      {...over}
    />,
  );

describe("Talk", () => {
  it("shows both sides", () => {
    show();
    expect(screen.getByText("pode seguir")).toBeTruthy();
    expect(screen.getByText("Levantei o terreno.")).toBeTruthy();
  });

  it("puts your words in a bubble, on the right", () => {
    // The side and the shape say who spoke. A name over every message is a
    // caption on something that already reads as a conversation.
    show();
    const mine = screen.getByText("pode seguir").closest("div");
    expect(mine?.className).toContain("bg-surface");
    expect(mine?.parentElement?.className).toContain("justify-end");
  });

  it("leaves the agent's words plain, on the left", () => {
    show();
    const theirs = screen.getByText("Levantei o terreno.").closest("div");
    expect(theirs?.className).not.toContain("bg-surface");
  });

  it("names nobody", () => {
    show();
    expect(screen.queryByText("You")).toBeNull();
    expect(screen.queryByText("agent")).toBeNull();
  });

  it("sets the agent's prose, so a list is a list", () => {
    show({ said: [said({ text: "Two things:\n\n- one\n- two" })] });
    expect(screen.getByText("one")).toBeTruthy();
    expect(screen.getByText("two")).toBeTruthy();
  });

  it("keeps your own words as you typed them, line breaks and all", () => {
    // Reformatting somebody's own words back at them is a small lie, and
    // the breaks are how a two-part message stays two parts.
    show({ said: [said({ kind: "you", text: "first line\n\nsecond line" })] });
    const mine = screen.getByText(/first line/);
    expect(mine.textContent).toBe("first line\n\nsecond line");
    expect(mine.closest("div")?.className).toContain("whitespace-pre-wrap");
  });

  it("draws a question as its options", () => {
    show({
      said: [
        said({
          kind: "asked",
          text: "Which way?",
          question: {
            header: "Route",
            prompt: "Which way?",
            multi: false,
            options: [{ label: "Left", description: "west", preview: null }],
          },
        }),
      ],
    });
    expect(screen.getByText("Left")).toBeTruthy();
    expect(screen.getByText(/Answer it in the terminal/)).toBeTruthy();
  });

  it("offers the older ones when there are some", () => {
    show({ more: true });
    expect(screen.getByText("Older")).toBeTruthy();
  });

  it("offers nothing once the beginning is on screen", () => {
    show({ more: false });
    expect(screen.queryByText("Older")).toBeNull();
  });

  it("asks for them when the button is pressed", () => {
    const onOlder = vi.fn();
    show({ more: true, onOlder });
    fireEvent.click(screen.getByText("Older"));
    expect(onOlder).toHaveBeenCalled();
  });

  // ── what it did between two things it said ─────────────────────────────

  it("keeps a run of tool calls closed, saying only how many", () => {
    // A working turn is thirty calls and four sentences, and the sentences
    // are what a supervisor is reading for.
    show({ said: [steps()] });
    expect(screen.getByText("3 steps")).toBeTruthy();
    expect(screen.queryByText("cargo test")).toBeNull();
  });

  it("opens into one line per call, with what it acted on", () => {
    show({ said: [steps()] });
    fireEvent.click(screen.getByText("3 steps"));
    expect(screen.getByText("src/x.rs")).toBeTruthy();
    expect(screen.getByText("cargo test")).toBeTruthy();
  });

  it("counts one call as a step and not as steps", () => {
    show({ said: [steps({ steps: [{ tool: "Read", target: "a", ok: true }] })] });
    expect(screen.getByText("1 step")).toBeTruthy();
  });

  it("says a call failed without being opened", () => {
    // The one thing worth seeing from outside: something in that run went
    // wrong, and the closed strip would otherwise hide it.
    show({ said: [steps()] });
    expect(screen.getByText("1 failed")).toBeTruthy();
  });

  it("says nothing about failures when none of them failed", () => {
    show({
      said: [steps({ steps: [{ tool: "Read", target: "a", ok: true }] })],
    });
    expect(screen.queryByText(/failed/)).toBeNull();
  });

  it("says so rather than showing a blank column", () => {
    show({ said: [] });
    expect(screen.getByText("Nothing said in this session yet.")).toBeTruthy();
  });
});
