import { useCallback, useEffect, useState } from "react";
import type { Queue } from "@/core/queue";
import { loadWork, type Work } from "@/core/work";

export interface WorkView {
  work: Work | null;
  failed: string | null;
  reload: () => void;
}

export function useWork(): WorkView {
  const [work, setWork] = useState<Work | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadWork()
      .then((w) => {
        setWork(w);
        setFailed(null);
      })
      .catch((e) => setFailed(String(e)));
  }, []);

  useEffect(reload, [reload]);
  return { work, failed, reload };
}

/// How many decisions are waiting on one project.
///
/// Taken from the queue rather than recomputed: the queue is the authority
/// on what needs you, and a second count derived a second way is a second
/// number that can disagree with the first.
export function waitingOn(queue: Queue, project: string): number {
  return queue.groups.flatMap((g) => g.items).filter((r) => r.item.project === project).length;
}
