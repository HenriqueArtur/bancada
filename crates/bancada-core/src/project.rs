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
    /// How fast waiting hurts here. Scales time; never overrides the kind
    /// of decision, so a permission on a heavy project stays below an
    /// architecture choice on a light one.
    #[serde(default = "one")]
    pub weight: u32,
    /// How long a finished turn stays quiet before it is worth your eyes.
    #[serde(default = "two")]
    pub idle_after_minutes: u32,
    /// Set while the project is not allowed to ask for you.
    ///
    /// Absent is the normal state. See [`Muted`] for why it carries two
    /// facts rather than being a flag.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub muted: Option<Muted>,
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

fn one() -> u32 {
    1
}
fn two() -> u32 {
    2
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

    pub fn idle_after_ms(&self) -> i64 {
        i64::from(self.idle_after_minutes) * 60_000
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
            weight: 1,
            idle_after_minutes: 2,
            muted: None,
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
    fn a_project_with_nothing_stated_is_baseline_weight_and_two_minutes() {
        let p: Project =
            serde_json::from_str(r#"{"id":"p","workspace":"w","runtime":"r","path":"/x"}"#)
                .unwrap();
        assert_eq!((p.weight, p.idle_after_ms()), (1, 120_000));
    }
}
