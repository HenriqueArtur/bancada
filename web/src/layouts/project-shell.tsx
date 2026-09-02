import type { ReactNode } from "react";
import { Bleed, Fill, Measure, Row, Scroller, Stack } from "@/frame";

/// The same chrome on every screen inside a project.
///
/// One shell rather than one per screen, and that is the whole point: the
/// way back, the project, the workspace, the work in progress and the tabs
/// sit at the same pixel on all four. Two shells meant the controls moved
/// when you changed tab — you had to find the tabs again to leave the place
/// the tabs had just taken you.
///
/// What varies is the body, and only the body. Prose wants a line short
/// enough to read to the end of; a diff wants every pixel and an index
/// beside it. `measured` chooses between them.
export function ProjectShell({
  back,
  title,
  aside,
  tabs,
  notice,
  measured,
  children,
}: {
  /// The way out, at the far left where it is in every other application.
  back: ReactNode;
  /// Which project, and whose work it is.
  title: ReactNode;
  /// What is already spoken for.
  aside?: ReactNode;
  tabs: ReactNode;
  /// Something true of the whole window before either pane is believed.
  notice?: ReactNode;
  /// A reading column rather than the whole width.
  measured?: boolean;
  children: ReactNode;
}) {
  return (
    <Bleed>
      <Stack gap="snug" className="shrink-0 border-line border-b bg-surface pt-2 pb-2">
        <Row gap="normal" justify="between" className="px-4">
          <Row gap="snug" align="baseline" className="min-w-0">
            {back}
            {title}
          </Row>
          {aside}
        </Row>
        {/* At the right. The left of this strip is where you came from and
            what you are looking at; the tabs are where you can go next, and
            putting them at the other end stops the two reading as one list. */}
        <Row gap="tight" justify="end" className="px-4">
          {tabs}
        </Row>
      </Stack>
      {notice}
      {measured ? (
        <Scroller className="min-h-0 flex-1">
          <Measure className="px-7 pt-8 pb-24">{children}</Measure>
        </Scroller>
      ) : (
        <Fill className="flex min-h-0 flex-col">{children}</Fill>
      )}
    </Bleed>
  );
}

/// A narrow index beside a wide subject, filling what is left of the window.
///
/// Each side scrolls on its own. A file tree that pushes the page down is a
/// tree you have to scroll past to reach the code it is indexing.
export function Panes({ index, subject }: { index: ReactNode; subject: ReactNode }) {
  return (
    <Row gap="none" align="stretch" className="min-h-0 flex-1">
      <Scroller className="w-[248px] shrink-0 border-line border-r py-2 pr-1 pl-2">
        {index}
      </Scroller>
      <Fill className="flex min-h-0 flex-col">{subject}</Fill>
    </Row>
  );
}
