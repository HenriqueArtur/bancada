/// One session's conversation, from the end.
import { invoke } from "@tauri-apps/api/core";
import type { Question } from "@/core/sessions";

/// One tool call, as the one thing worth reading in it.
export interface Step {
  tool: string;
  /// The path, the command, the pattern. Summarised on the Rust side: the
  /// whole input is a hundred kilobytes of edit for a row that shows forty
  /// characters of it.
  target: string;
  /// `false` only when the log says the *tool* failed. A shell exiting 127
  /// is a successful tool result whose content says so.
  ok: boolean;
}

/// One entry in the thread.
///
/// A union rather than one shape with empty fields: a run of tool calls has
/// no speaker and no words, and drawing it as an agent message with a blank
/// body is an empty bubble on every working turn.
export type Said =
  | { kind: "you"; text: string; at: number }
  | { kind: "agent"; text: string; at: number }
  | { kind: "asked"; text: string; at: number; question: Question }
  /// What it did between two things it said, folded into one entry.
  | { kind: "steps"; at: number; steps: Step[] };

export interface Chat {
  /// Oldest first, so it reads downward like the conversation it is.
  said: Said[];
  /// Whether asking for another page would bring anything.
  more: boolean;
}

/// `skip` is how many entries from the end are already on screen.
export const loadChat = (project: string, session: string, skip: number): Promise<Chat> =>
  invoke<Chat>("chat", { project, session, skip });
