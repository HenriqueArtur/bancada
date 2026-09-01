import type { ReactNode } from "react";
import { Bleed, Fill, Row, Scroller } from "@/frame";

/// A narrow index beside a wide subject, filling the window.
///
/// Shaped after an editor rather than after the rest of the product, because
/// that is what it is: you came here to read a file, and every pixel spent on
/// margin is a character of the file you cannot see. One hairline between the
/// panes and no gap at all — the border does the separating that whitespace
/// would otherwise have to.
///
/// Each side scrolls on its own. A file tree that pushes the page down is a
/// tree you have to scroll past to reach the code it is indexing.
export function Workbench({
  bar,
  index,
  subject,
}: {
  /// The strip across the top: where you are, and the way back.
  bar: ReactNode;
  index: ReactNode;
  subject: ReactNode;
}) {
  return (
    <Bleed>
      <Row
        gap="normal"
        justify="between"
        className="shrink-0 border-b border-line bg-surface px-4 py-2"
      >
        {bar}
      </Row>
      <Row gap="none" align="stretch" className="min-h-0 flex-1">
        <Scroller className="w-[248px] shrink-0 border-r border-line py-2 pl-2 pr-1">
          {index}
        </Scroller>
        <Fill>{subject}</Fill>
      </Row>
    </Bleed>
  );
}
