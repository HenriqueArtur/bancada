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

    pub fn idle_after_ms(&self) -> i64 {
        i64::from(self.idle_after_minutes) * 60_000
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(path: &str) -> Project {
        Project {
            id: "p".into(),
            workspace: "w".into(),
            runtime: "r".into(),
            path: path.into(),
            weight: 1,
            idle_after_minutes: 2,
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
