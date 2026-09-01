import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Speaks, useText } from "@/lib/language";

function Says() {
  const t = useText();
  return <p>{t("Needs you")}</p>;
}

describe("Speaks", () => {
  it("gives everything under it the catalogue for that language", () => {
    render(
      <Speaks language="en">
        <Says />
      </Speaks>,
    );
    expect(screen.getByText("Needs you")).toBeTruthy();
  });

  it("falls back to the phrase for a language with no translation", () => {
    // Portuguese ships registered and empty, and this is what that looks
    // like from the inside: English, in place, rather than a blank screen.
    render(
      <Speaks language="pt-BR">
        <Says />
      </Speaks>,
    );
    expect(screen.getByText("Needs you")).toBeTruthy();
  });

  it("speaks English outside any provider rather than throwing", () => {
    // A component rendered in a test has no provider and still has to
    // produce its own words; a hook that threw would make every spec set
    // one up to say nothing.
    render(<Says />);
    expect(screen.getByText("Needs you")).toBeTruthy();
  });
});
