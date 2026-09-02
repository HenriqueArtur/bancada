/// What each session of a project is doing, and what it last said.
import { invoke } from "@tauri-apps/api/core";

export interface QuestionOption {
  label: string;
  description: string;
  preview: string | null;
}

/// A question the harness raised, already structured.
///
/// It arrives as cards because it *is* cards in the log — the harness wrote
/// the options, and drawing them is rendering rather than parsing.
export interface Question {
  header: string;
  prompt: string;
  multi: boolean;
  options: QuestionOption[];
}

export interface Session {
  id: string;
  /// The first thing the human said, which is what the session is about.
  title: string | null;
  /// The question it is stopped on. `null` unless the last thing it did was
  /// ask — an answered one is history.
  asked: Question | null;
  /// The last thing it said in prose.
  said: string | null;
  /// The last thing you said to it.
  heard: string | null;
  /// When anything last happened, in milliseconds.
  at: number;
  /// Stopped on you. The same fact that lights the dock badge.
  waiting: boolean;
}

export const loadSessions = (project: string): Promise<Session[]> =>
  invoke<Session[]>("sessions", { project });
