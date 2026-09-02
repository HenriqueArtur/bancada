import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Since } from "@/pages/git/since";

const NOW = 1_756_742_400_000;
const secondsAgo = (n: number) => NOW / 1000 - n;

describe("Since", () => {
  it("says the coarsest unit that is still true", () => {
    render(<Since when={secondsAgo(3 * 86_400)} now={NOW} />);
    expect(screen.getByText("3 days ago")).toBeTruthy();
  });

  it("agrees with itself in the singular", () => {
    render(<Since when={secondsAgo(3_600)} now={NOW} />);
    expect(screen.getByText("1 hour ago")).toBeTruthy();
  });

  it("falls all the way to seconds for something that just happened", () => {
    render(<Since when={secondsAgo(4)} now={NOW} />);
    expect(screen.getByText("4 seconds ago")).toBeTruthy();
  });
});
