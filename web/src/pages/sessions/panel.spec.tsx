import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@/core/sessions";

const loadChat = vi.fn();
vi.mock("@/core/chat", async () => {
  const real = await vi.importActual<typeof import("@/core/chat")>("@/core/chat");
  return { ...real, loadChat: (...a: unknown[]) => loadChat(...a) };
});
vi.mock("@/core/live", () => ({
  live: () => ({ stop: () => {}, asking: Promise.resolve(true) }),
}));

const { ChatPanel, SessionList } = await import("@/pages/sessions/panel");

const session = (over: Partial<Session> = {}): Session => ({
  id: "10414dd9",
  title: "Discuss the sessions screen",
  asked: null,
  said: "done",
  heard: "go",
  at: Date.now(),
  waiting: false,
  kept: false,
  quieted: false,
  ...over,
});

const said = (text: string) => ({ who: "agent" as const, text, at: 1, asked: null });

const show = (over: Partial<Parameters<typeof ChatPanel>[0]> = {}) =>
  render(
    <ChatPanel
      project="bancada"
      sessions={[
        session(),
        session({ id: "55a56b23", title: "Fix the doctor", waiting: true }),
      ]}
      session="10414dd9"
      onSession={vi.fn()}
      onClose={vi.fn()}
      {...over}
    />,
  );

describe("ChatPanel", () => {
  it("reads the newest page of the session it is on", async () => {
    loadChat.mockResolvedValueOnce({ said: [said("hello")], more: false });
    show();
    await waitFor(() => expect(screen.getByText("hello")).toBeTruthy());
    expect(loadChat).toHaveBeenCalledWith("bancada", "10414dd9", 0);
  });

  it("names the session it is showing", async () => {
    loadChat.mockResolvedValueOnce({ said: [], more: false });
    show();
    await waitFor(() => expect(screen.getByText("Discuss the sessions screen")).toBeTruthy());
  });

  it("puts older messages in front, because the list reads downward", async () => {
    loadChat.mockResolvedValueOnce({ said: [said("newer")], more: true });
    show();
    await waitFor(() => expect(screen.getByText("newer")).toBeTruthy());

    loadChat.mockResolvedValueOnce({ said: [said("older")], more: false });
    fireEvent.click(screen.getByText("Older"));
    await waitFor(() => expect(screen.getByText("older")).toBeTruthy());
    expect(loadChat).toHaveBeenLastCalledWith("bancada", "10414dd9", 1);
  });

  it("names the session it is showing", async () => {
    loadChat.mockResolvedValueOnce({ said: [], more: false });
    show();
    await waitFor(() => expect(screen.getByText("Discuss the sessions screen")).toBeTruthy());
  });

  it("can be closed", async () => {
    const onClose = vi.fn();
    loadChat.mockResolvedValueOnce({ said: [], more: false });
    show({ onClose });
    fireEvent.click(screen.getByLabelText("Hide the conversation"));
    expect(onClose).toHaveBeenCalled();
  });

  it("says why when the conversation cannot be read", async () => {
    loadChat.mockRejectedValueOnce("no such session");
    show();
    await waitFor(() => expect(screen.getByText(/no such session/)).toBeTruthy());
  });

  it("asks for nothing when no session is chosen", () => {
    loadChat.mockClear();
    show({ session: null });
    expect(loadChat).not.toHaveBeenCalled();
    expect(screen.getByText("No session")).toBeTruthy();
  });
});

/// Through the list itself rather than through the popover: opening a Radix
/// portal in a test costs about seven seconds, and this asserts the same
/// thing in milliseconds.
describe("SessionList", () => {
  it("offers the other sessions, marking who is waiting", () => {
    const onSession = vi.fn();
    render(
      <SessionList
        sessions={[
          session(),
          session({ id: "55a56b23", title: "Fix the doctor", waiting: true }),
        ]}
        session="10414dd9"
        onSession={onSession}
      />,
    );
    expect(screen.getByText("waiting")).toBeTruthy();
    fireEvent.click(screen.getByText("Fix the doctor"));
    expect(onSession).toHaveBeenCalledWith("55a56b23");
  });

  it("falls back to the id when a session was never given a title", () => {
    render(
      <SessionList
        sessions={[session({ id: "abcdef12", title: null })]}
        session={null}
        onSession={vi.fn()}
      />,
    );
    expect(screen.getAllByText("abcdef12").length).toBe(2);
  });
});
