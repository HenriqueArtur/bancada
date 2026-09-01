import { useCallback, useEffect, useState } from "react";
import type { FileDiff, ReviewView } from "@/core/review";
import { loadReview, markSeen } from "@/core/review";

export interface Review {
  data: ReviewView | null;
  failed: string | null;
  /// Vouch for a file at the shape it currently has.
  vouch: (f: FileDiff) => void;
}

export function useReview(project: string): Review {
  const [data, setData] = useState<ReviewView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    loadReview(project)
      .then(setData)
      .catch((e) => setFailed(String(e)));
  }, [project]);

  useEffect(load, [load]);

  const vouch = (f: FileDiff) => {
    markSeen(project, f.path, f.fingerprint);
    load();
  };

  return { data, failed, vouch };
}

/// Unannounced first, then what moved since you last looked, then by name.
///
/// Extracted from the view so the order can be asserted without rendering
/// anything — it is the whole argument of the screen, and an ordering bug
/// looks like nothing at all.
export function readingOrder(files: FileDiff[], unannounced: string[]): FileDiff[] {
  const surprising = new Set(unannounced);
  return [...files].sort(
    (a, b) =>
      Number(surprising.has(b.path)) - Number(surprising.has(a.path)) ||
      Number(b.fresh) - Number(a.fresh) ||
      a.path.localeCompare(b.path),
  );
}
