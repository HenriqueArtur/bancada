/// Deciding what is worth interrupting a person for.
import { invoke } from "@tauri-apps/api/core";
import { label, type Grouped, type Queue, type Ranked } from "./queue";

export interface Announce {
  title: string;
  body: string;
}

/// A stable identity for one queue item.
///
/// Session plus kind plus when it was raised. Not the score, which moves
/// every second, and not the position, which moves when anything else
/// arrives — an identity that changes on its own would announce the same
/// decision over and over.
export function identify(r: Ranked): string {
  return `${r.item.session}:${r.item.kind}:${r.item.raised_at}`;
}

export function idsOf(groups: Grouped[]): Set<string> {
  return new Set(groups.flatMap((g) => g.items).map(identify));
}

/// Items in the queue now that were not in it before.
///
/// `null` for the first reading of a session. Everything is new when you
/// have never looked, and announcing a queue you just opened would train
/// you to dismiss the notification that matters.
export function newcomers(before: Set<string> | null, now: Grouped[]): Ranked[] {
  if (before === null) return [];
  return now.flatMap((g) => g.items).filter((r) => !before.has(identify(r)));
}

/// What to say, in as few words as a notification can hold.
export function phrase(fresh: Ranked[]): Announce | null {
  if (fresh.length === 0) return null;

  const first = fresh[0];
  const session = first.item.session.slice(0, 8);
  const title =
    fresh.length === 1
      ? `${first.item.project} · ${label(first.item.kind)}`
      : `${first.item.project} · ${fresh.length} things need you`;

  const body =
    fresh.length === 1
      ? `session ${session}`
      : fresh
          .slice(0, 3)
          .map((r) => label(r.item.kind))
          .join(", ") + (fresh.length > 3 ? `, and ${fresh.length - 3} more` : "");

  return { title, body };
}

/// How many sessions are waiting — the number the dock carries.
///
/// Sessions, not items: three permissions from one agent is one thing to go
/// and deal with, and a badge that counts them separately turns into a
/// number nobody reads.
export function waiting(q: Queue): number {
  return q.wip.sessions_waiting;
}

export const raise = (count: number, announce: Announce | null): Promise<void> =>
  invoke<void>("attention", { waiting: count, announce });
