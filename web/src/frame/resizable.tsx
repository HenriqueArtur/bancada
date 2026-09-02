import type { ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/cn";

/// A column whose width you can drag, against one edge of the window.
///
/// In `frame` rather than in the page that uses it, for the reason the whole
/// layer exists: a width is how a thing sits, not what it is, and a page
/// setting one inline would be a design decision made outside the design
/// system. The clamping is the caller's, because only the caller knows what
/// is too narrow to read.
export function Resizable({
  width,
  onWidth,
  side,
  step = 16,
  label,
  className,
  children,
}: {
  width: number;
  onWidth: (px: number) => void;
  /// Which edge of the window it sits against. The grip goes on the other
  /// one — the edge facing the content. Dragging the window's own edge is
  /// the operating system's gesture, not this one.
  side: "left" | "right";
  step?: number;
  /// What the grip is called, for whoever is not using a mouse.
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const from = useRef({ x: 0, width: 0 });
  const grow = (by: number) => onWidth(width + by);

  return (
    <div style={{ width }} className={cn("relative flex shrink-0 flex-col", className)}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "absolute inset-y-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-clay/40",
          "focus-visible:bg-clay/40 focus-visible:outline-none",
          side === "right" ? "left-0" : "right-0",
        )}
        onPointerDown={(e) => {
          from.current = { x: e.clientX, width };
          // Captured, because the pointer leaves a four-pixel strip on the
          // first frame of any real drag — and without this the column stops
          // following your hand the moment it does.
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          // Away from the content is wider, whichever edge it sits against.
          const by = side === "right" ? from.current.x - e.clientX : e.clientX - from.current.x;
          onWidth(from.current.width + by);
        }}
        onKeyDown={(e) => {
          // The keyboard reaches it too. A control only a mouse can work is
          // a control half the people using this cannot.
          const by = e.shiftKey ? step * 4 : step;
          if (e.key === "ArrowLeft") grow(side === "right" ? by : -by);
          else if (e.key === "ArrowRight") grow(side === "right" ? -by : by);
          else return;
          e.preventDefault();
        }}
      />
      {children}
    </div>
  );
}
