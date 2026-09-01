use serde::Serialize;

/// A unified diff, split per file, with a fingerprint per file.
///
/// The fingerprint is what makes the *second* look cheap: a reviewer who saw
/// `src/db.rs` an hour ago and comes back to a queue of forty files needs to
/// know which three moved, not to read all forty again. Nothing here stores
/// what was seen — the caller keeps that, and passes it back.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Diff {
    pub files: Vec<FileDiff>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub added: usize,
    pub removed: usize,
    pub hunks: Vec<Hunk>,
    /// Stable across runs, changes when the file's diff changes.
    pub fingerprint: String,
    /// Set by [`Diff::mark_fresh`]: this file moved since the caller last
    /// looked. Default `true` — a file nobody has vouched for is unreviewed,
    /// and defaulting the other way hides work.
    pub fresh: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Hunk {
    pub header: String,
    pub lines: Vec<Line>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    pub kind: LineKind,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LineKind {
    Added,
    Removed,
    Context,
}

impl Diff {
    /// Parse `git diff` unified output.
    ///
    /// Deliberately not a git library: the product reads a runtime it may not
    /// share a filesystem with, so the only thing it can count on is the text
    /// a command printed.
    pub fn parse(text: &str) -> Self {
        let mut files: Vec<FileDiff> = Vec::new();
        for line in text.lines() {
            if let Some(path) = header_path(line) {
                files.push(FileDiff {
                    path,
                    added: 0,
                    removed: 0,
                    hunks: Vec::new(),
                    fingerprint: String::new(),
                    fresh: true,
                });
                continue;
            }
            let Some(file) = files.last_mut() else {
                continue;
            };

            if line.starts_with("@@") {
                file.hunks.push(Hunk {
                    header: line.to_owned(),
                    lines: Vec::new(),
                });
                continue;
            }
            let Some(hunk) = file.hunks.last_mut() else {
                continue;
            };

            // `+++`/`---` never reach here: they precede the first `@@`.
            let (kind, text) = match line.as_bytes().first() {
                Some(b'+') => (LineKind::Added, &line[1..]),
                Some(b'-') => (LineKind::Removed, &line[1..]),
                Some(b'\\') => continue, // "\ No newline at end of file"
                _ => (LineKind::Context, line.get(1..).unwrap_or("")),
            };
            match kind {
                LineKind::Added => file.added += 1,
                LineKind::Removed => file.removed += 1,
                LineKind::Context => {}
            }
            hunk.lines.push(Line {
                kind,
                text: text.to_owned(),
            });
        }

        for f in &mut files {
            f.fingerprint = fingerprint(f);
        }
        Diff { files }
    }

    /// Mark every file the caller has not vouched for at its current shape.
    ///
    /// `seen` maps path to the fingerprint the caller last acknowledged. A
    /// path missing from `seen`, or present with a stale fingerprint, stays
    /// fresh.
    pub fn mark_fresh(&mut self, seen: &std::collections::HashMap<String, String>) {
        for f in &mut self.files {
            f.fresh = seen.get(&f.path) != Some(&f.fingerprint);
        }
    }

    pub fn added(&self) -> usize {
        self.files.iter().map(|f| f.added).sum()
    }

    pub fn removed(&self) -> usize {
        self.files.iter().map(|f| f.removed).sum()
    }
}

/// The path from a `diff --git a/x b/x` line, in the *new* spelling.
fn header_path(line: &str) -> Option<String> {
    let rest = line.strip_prefix("diff --git ")?;
    // A rename gives two different paths; the second is where the code is
    // now, and that is the one a reviewer opens.
    let b = rest.rfind(" b/")?;
    Some(rest[b + 3..].to_owned())
}

/// A cheap, stable hash of what the file's diff currently says.
///
/// FNV-1a rather than a crate: the value never leaves the process and never
/// has to survive a version change, so a dependency would buy nothing.
fn fingerprint(f: &FileDiff) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let mut eat = |s: &str| {
        for b in s.as_bytes() {
            h ^= u64::from(*b);
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
    };
    eat(&f.path);
    for hunk in &f.hunks {
        eat(&hunk.header);
        for l in &hunk.lines {
            eat(match l.kind {
                LineKind::Added => "+",
                LineKind::Removed => "-",
                LineKind::Context => " ",
            });
            eat(&l.text);
        }
    }
    format!("{h:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    const SAMPLE: &str = "diff --git a/src/db.rs b/src/db.rs\nindex 111..222 100644\n--- a/src/db.rs\n+++ b/src/db.rs\n@@ -1,3 +1,4 @@\n fn open() {\n-    old();\n+    new();\n+    extra();\n }\n";

    #[test]
    fn a_diff_splits_into_files_with_counts() {
        let d = Diff::parse(SAMPLE);
        assert_eq!(d.files.len(), 1);
        assert_eq!(d.files[0].path, "src/db.rs");
        assert_eq!((d.added(), d.removed()), (2, 1));
    }

    #[test]
    fn the_plus_plus_plus_line_is_not_counted_as_an_addition() {
        // It sits before the first `@@`, so it never enters a hunk. If that
        // ever changes every file gains a phantom +1/-1.
        assert_eq!(Diff::parse(SAMPLE).files[0].added, 2, "+++ leaked in");
    }

    #[test]
    fn a_rename_is_named_by_where_the_code_is_now() {
        let d = Diff::parse("diff --git a/old.rs b/new.rs\n@@ -1 +1 @@\n-a\n+b\n");
        assert_eq!(d.files[0].path, "new.rs");
    }

    #[test]
    fn a_file_nobody_vouched_for_is_fresh() {
        let mut d = Diff::parse(SAMPLE);
        d.mark_fresh(&HashMap::new());
        assert!(d.files[0].fresh, "silence is not review");
    }

    #[test]
    fn a_file_seen_at_this_exact_shape_is_not_fresh() {
        let mut d = Diff::parse(SAMPLE);
        let seen = fingerprints(&d);
        d.mark_fresh(&seen);
        assert!(!d.files[0].fresh);
    }

    #[test]
    fn a_file_that_moved_since_it_was_seen_is_fresh_again() {
        let mut before = Diff::parse(SAMPLE);
        let seen = fingerprints(&before);

        let mut after = Diff::parse(&SAMPLE.replace("extra();", "different();"));
        after.mark_fresh(&seen);
        assert!(after.files[0].fresh, "the file changed and nobody was told");

        before.mark_fresh(&seen);
        assert!(!before.files[0].fresh);
    }

    #[test]
    fn an_empty_diff_is_empty_rather_than_an_error() {
        assert_eq!(Diff::parse(""), Diff::default());
    }

    #[test]
    fn output_before_any_file_header_is_ignored_rather_than_crashing() {
        let noise = "warning: LF will be replaced\n@@ -1 +1 @@\n+x\n";
        assert!(Diff::parse(noise).files.is_empty());
    }

    fn fingerprints(d: &Diff) -> HashMap<String, String> {
        d.files
            .iter()
            .map(|f| (f.path.clone(), f.fingerprint.clone()))
            .collect()
    }
}
