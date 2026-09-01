import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguagePanel } from "@/pages/settings/language";

describe("LanguagePanel", () => {
  it("offers following the machine as well as each language", () => {
    render(<LanguagePanel language={null} onChoose={vi.fn()} />);
    expect(screen.getByText("Follow the system")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Português (Brasil)")).toBeTruthy();
  });

  it("never translates a language's own name", () => {
    // Somebody looking for their own language looks for the word they use
    // for it. "Portuguese" on a Brazilian machine is a list they have to
    // read in the language they came here to leave.
    render(<LanguagePanel language="pt-BR" onChoose={vi.fn()} />);
    expect(screen.queryByText("Portuguese")).toBeNull();
    expect(screen.getByText("Português (Brasil)")).toBeTruthy();
  });

  it("marks the one in force, and only that one", () => {
    const { container } = render(<LanguagePanel language="en" onChoose={vi.fn()} />);
    const marked = container.querySelectorAll("[aria-current]");
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toContain("English");
  });

  it("marks following the machine when nothing was chosen", () => {
    // Absent is not English. It means *follow*, and showing English as the
    // selection would make a machine set to Portuguese look ignored.
    const { container } = render(<LanguagePanel language={null} onChoose={vi.fn()} />);
    expect(container.querySelector("[aria-current]")?.textContent).toContain(
      "Follow the system",
    );
  });

  it("says English is the source rather than counting it", () => {
    render(<LanguagePanel language={null} onChoose={vi.fn()} />);
    expect(screen.getByText(/The source/)).toBeTruthy();
  });

  it("says out loud that nothing is translated yet", () => {
    // The honest state. The machinery is finished and no translating has
    // happened, and a selector that hid that would look broken instead.
    render(<LanguagePanel language={null} onChoose={vi.fn()} />);
    expect(screen.getByText(/Nothing is translated yet/)).toBeTruthy();
  });

  it("hands the choice up, including going back to following", () => {
    const onChoose = vi.fn();
    render(<LanguagePanel language="en" onChoose={onChoose} />);
    fireEvent.click(screen.getByText("Follow the system"));
    expect(onChoose).toHaveBeenCalledWith(null);
  });
});
