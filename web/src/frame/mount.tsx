import type { Ref } from "react";
import { cn } from "@/lib/cn";

/// An empty box for something that is not React.
///
/// Monaco writes its own DOM into a node we hand it. That node still has to
/// come from somewhere the design system allows, or the rule against raw
/// HTML has an exception in exactly the place a stray `<div>` is easiest to
/// justify.
export function Mount({ ref, className }: { ref: Ref<HTMLDivElement>; className?: string }) {
  return <div ref={ref} className={cn("h-full", className)} />;
}
