/// What each session of a project is doing, and what it last said.
import { invoke } from "@tauri-apps/api/core";
import type { Config } from "@/core/settings";

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
  /// Held back from the rule that quiets a session once a newer one begins.
  kept: boolean;
  /// Silent *because* a newer session began, rather than because nothing has
  /// happened here. The two look identical on a screen and only one of them
  /// has a switch, so the screen is told which.
  quieted: boolean;
}

export const loadSessions = (project: string): Promise<Session[]> =>
  invoke<Session[]>("sessions", { project });

/// Keep one session out of reach of the rule that quiets the old ones, or
/// let it go again.
export const keepSession = (project: string, session: string, kept: boolean): Promise<Config> =>
  invoke<Config>("keep_session", { project, session, kept });
