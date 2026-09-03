use crate::Stated;
use bancada_meta::Timestamp;
use serde::{Deserialize, Serialize};

/// One body of content with work happening in it.
///
/// Four independent axes: where it runs, whose it is, where it lives, and
/// how fast waiting hurts. They coincide by accident today and break apart
/// the first time a project runs on this machine with no guest at all.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub workspace: String,
    pub runtime: String,
    /// The path as the *guest* spells it — which is how the log spells it.
    pub path: String,
    /// What this project says about its own numbers.
    ///
    /// What it does not say, its workspace says; what neither says, the
    /// preset says. See [`crate::Limits::resolve`] for the order.
    #[serde(default, skip_serializing_if = "Stated::is_empty")]
    pub limits: Stated,
    /// Superseded by `limits`, and read only on the way in.
    ///
    /// A configuration written before presets existed states these at the
    /// top level of a project. [`Project::migrated`] folds them into
    /// `limits` and the next save drops them, so nobody loses a number they
    /// chose — which is the one failure a settings migration is not allowed
    /// to have. Kept rather than aliased: serde has no alias across a
    /// nesting level, and these two are one level out from where they now
    /// belong.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub idle_after_minutes: Option<u32>,
    /// Set while the project is not allowed to ask for you.
    ///
    /// Absent is the normal state. See [`Muted`] for why it carries two
    /// facts rather than being a flag.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub muted: Option<Muted>,
    /// Sessions a newer one may not quiet.
    ///
    /// Opening a session is how you say you have moved on from the last
    /// one, and the queue takes it that way — which is right for the
    /// session you abandoned and wrong for the long-running one you mean to
    /// come back to. This is how you say "not that one".
    ///
    /// Ids rather than a count, unlike [`Muted`]: this names a particular
    /// session, and a count cannot. The cost is that a log deleted leaves
    /// its id behind, which is a dead string and nothing more.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub kept: Vec<String>,
}

/// When you silenced a project, and how much work it had then.
///
/// Not a boolean. You silence a project because the work there is finished,
/// and the day you start working there again is the day you need it back —
/// forgetting to un-silence it is the exact failure an attention supervisor
/// exists to prevent. So a session that did not exist when you silenced it
/// wakes the project on its own.
///
/// The count, not a timestamp comparison, is what makes that decidable in
/// both places that need it. The queue and the work list both already know
/// how many session logs a project has; neither reads a word of them, and a
/// rule needing the *content* of every log would have made the work list
/// pay for a diff it does not show. Two screens computing "is this asking
/// for me" from two different signals is how a product ends up disagreeing
/// with itself about what needs you.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Muted {
    /// So a screen can say how long ago, and so silencing twice is
    /// distinguishable from never having un-silenced.
    pub at: Timestamp,
    /// Sessions the project had at that moment.
    pub sessions: usize,
}

impl Project {
    /// The directory the harness keeps this project's logs in.
    ///
    /// **Computed, never decoded.** The encoding turns both `/` and `.`
    /// into `-`, so `a.b` and `a-b` collide: reading a directory name and
    /// reversing it would be a guess that is right most of the time, which
    /// is the worst kind. Found by recording a session, not by reasoning.
    pub fn log_dir_name(&self) -> String {
        self.path
            .chars()
            .map(|c| if c == '/' || c == '.' { '-' } else { c })
            .collect()
    }

    /// Whether this project may ask for your attention right now.
    ///
    /// `sessions` is how many session logs it has. A silenced project comes
    /// back on its own when one appears that was not there when you silenced
    /// it: you silenced it because the work ended, and a new session is new
    /// work. A log deleted and another created keeps the count level and so
    /// misses — rare, and quieter than the alternative, which is waking on
    /// every continuation of a conversation you already dismissed.
    pub fn asking(&self, sessions: usize) -> bool {
        self.muted.is_none_or(|m| sessions > m.sessions)
    }

    /// Fold a pre-preset configuration into `limits`.
    ///
    /// Run once on the way in, by [`crate::Config::parse`]. The stated
    /// number wins over nothing, never over something: a file carrying both
    /// spellings was written by a newer bancada and edited by an older one,
    /// and the newer place is the one to believe.
    #[must_use]
    pub fn migrated(mut self) -> Self {
        if self.limits.weight.is_none() {
            self.limits.weight = self.weight;
        }
        if self.limits.idle_after_minutes.is_none() {
            self.limits.idle_after_minutes = self.idle_after_minutes;
        }
        self.weight = None;
        self.idle_after_minutes = None;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn silenced(at: i64, sessions: usize) -> Project {
        Project {
            muted: Some(Muted {
                at: Timestamp::from_millis(at),
                sessions,
            }),
            ..project("/mnt/dev/x")
        }
    }

    #[test]
    fn a_project_nobody_silenced_may_ask() {
        assert!(project("/mnt/dev/x").asking(0));
    }

    #[test]
    fn a_silenced_project_with_the_same_work_stays_quiet() {
        assert!(!silenced(1_000, 3).asking(3));
    }

    #[test]
    fn a_session_that_did_not_exist_then_wakes_it() {
        // You silenced it because the work ended. A new session is new work,
        // and forgetting to un-silence is the failure this product exists to
        // prevent.
        assert!(silenced(1_000, 3).asking(4));
    }

    #[test]
    fn a_session_going_away_does_not_wake_it() {
        // Fewer than there were is not new work. Reading it as "the count
        // changed" would wake a project every time a log is cleaned up.
        assert!(!silenced(1_000, 3).asking(1));
    }

    fn project(path: &str) -> Project {
        Project {
            id: "p".into(),
            workspace: "w".into(),
            runtime: "r".into(),
            path: path.into(),
            limits: Stated::default(),
            weight: None,
            idle_after_minutes: None,
            muted: None,
            kept: Vec::new(),
        }
    }

    #[test]
    fn a_path_becomes_the_directory_the_harness_writes_to() {
        assert_eq!(
            project("/mnt/dev/neo-gitmoji.nvim").log_dir_name(),
            "-mnt-dev-neo-gitmoji-nvim"
        );
    }

    #[test]
    fn the_encoding_is_lossy_which_is_why_it_is_never_reversed() {
        assert_eq!(
            project("/a/b.c").log_dir_name(),
            project("/a/b-c").log_dir_name(),
            "if these ever differ, decoding might be safe — it is not today"
        );
    }

    #[test]
    fn a_project_with_nothing_stated_states_nothing() {
        // The numbers are no longer the project's alone, so the absence has
        // to survive to where the workspace can be asked. A default filled
        // in here would look exactly like a number somebody chose.
        let p: Project =
            serde_json::from_str(r#"{"id":"p","workspace":"w","runtime":"r","path":"/x"}"#)
                .unwrap();
        assert!(p.limits.is_empty());
    }

    #[test]
    fn a_configuration_written_before_presets_keeps_its_numbers() {
        // The failure a settings migration is not allowed to have. This
        // spelling is what is in the file on the machine this was written
        // on, with one project deliberately at one minute.
        let stored: Project = serde_json::from_str(
            r#"{"id":"p","workspace":"w","runtime":"r","path":"/x","weight":3,"idleAfterMinutes":1}"#,
        )
        .unwrap();
        let p = stored.migrated();
        assert_eq!(p.limits.weight, Some(3));
        assert_eq!(p.limits.idle_after_minutes, Some(1));
        // And the old spelling is gone, so the next save writes one place.
        assert_eq!((p.weight, p.idle_after_minutes), (None, None));
    }

    #[test]
    fn the_newer_spelling_wins_when_a_file_carries_both() {
        // Written by a newer bancada, then edited by an older one. The
        // newer place is the one that was chosen most recently.
        let stored: Project = serde_json::from_str(
            r#"{"id":"p","workspace":"w","runtime":"r","path":"/x","weight":3,"limits":{"weight":5}}"#,
        )
        .unwrap();
        let p = stored.migrated();
        assert_eq!(p.limits.weight, Some(5));
    }
}
