import type { ReactNode } from "react";
import { Split } from "@/frame";

/// A narrow index beside a wide subject, sized to the window.
export function Workbench({ index, subject }: { index: ReactNode; subject: ReactNode }) {
  return (
    <Split
      index={index}
      subject={subject}
      className="h-[calc(100vh-190px)] min-h-[360px]"
    />
  );
}
