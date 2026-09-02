import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Resizable } from "@/frame/resizable";

/// jsdom has no `PointerEvent`, so testing-library builds a bare `Event` for
/// one — and a bare event carries no `clientX`. A `MouseEvent` under the
/// pointer name is the same interface the handler reads.
const at = (what: string, x: number) =>
  new MouseEvent(what, { clientX: x, bubbles: true, cancelable: true });

const show = (over: Partial<Parameters<typeof Resizable>[0]> = {}) => {
  const onWidth = vi.fn();
  render(
    <Resizable width={340} onWidth={onWidth} side="right" label="Drag me" {...over}>
      {null}
    </Resizable>,
  );
  return { onWidth, grip: screen.getByLabelText("Drag me") };
};

describe("Resizable", () => {
  it("is as wide as it was told to be", () => {
    show();
    expect(screen.getByLabelText("Drag me").parentElement?.style.width).toBe("340px");
  });

  it("puts the grip on the edge facing the content", () => {
    // Dragging the window's own edge is the operating system's gesture.
    const { grip } = show({ side: "right" });
    expect(grip.className).toContain("left-0");
  });

  it("puts it on the other edge when it sits on the left", () => {
    const { grip } = show({ side: "left" });
    expect(grip.className).toContain("right-0");
  });

  it("grows away from the content on the arrow keys", () => {
    const { onWidth, grip } = show({ side: "right" });
    fireEvent.keyDown(grip, { key: "ArrowLeft" });
    expect(onWidth).toHaveBeenCalledWith(356);
  });

  it("grows the other way when it sits on the left", () => {
    const { onWidth, grip } = show({ side: "left" });
    fireEvent.keyDown(grip, { key: "ArrowLeft" });
    expect(onWidth).toHaveBeenCalledWith(324);
  });

  it("takes a bigger step with shift held", () => {
    const { onWidth, grip } = show();
    fireEvent.keyDown(grip, { key: "ArrowLeft", shiftKey: true });
    expect(onWidth).toHaveBeenCalledWith(404);
  });

  it("leaves every other key to whoever else wants it", () => {
    const { onWidth, grip } = show();
    fireEvent.keyDown(grip, { key: "Enter" });
    expect(onWidth).not.toHaveBeenCalled();
  });

  it("follows the pointer once it has captured it", () => {
    const { onWidth, grip } = show({ side: "right" });
    grip.setPointerCapture = vi.fn();
    grip.hasPointerCapture = () => true;
    fireEvent(grip, at("pointerdown", 900));
    fireEvent(grip, at("pointermove", 800));
    // Leftwards, against a panel on the right, is a hundred pixels wider.
    expect(onWidth).toHaveBeenCalledWith(440);
  });

  it("ignores a pointer it never captured", () => {
    // The move fires on hover too, and a panel that resized on hover would
    // be unusable.
    const { onWidth, grip } = show();
    grip.hasPointerCapture = () => false;
    fireEvent(grip, at("pointermove", 800));
    expect(onWidth).not.toHaveBeenCalled();
  });
});
