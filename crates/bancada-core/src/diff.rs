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
    /// What happened to the file, not just how much of it moved.
    ///
    /// A deleted file and a heavily cut one both read as "−300" and are not
    /// the same news. Taken from the header lines git already prints above
    /// the first hunk, so nothing extra is asked of the runtime.
    pub status: Status,
    /// Where a renamed file used to be. `None` for everything else.
    pub from: Option<String>,
    pub hunks: Vec<Hunk>,
    /// Stable across runs, changes when the file's diff changes.
    pub fingerprint: String,
    /// Set by [`Diff::mark_fresh`]: this file moved since the caller last
    /// looked. Default `true` — a file nobody has vouched for is unreviewed,
    /// and defaulting the other way hides work.
    pub fresh: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hunk {
    pub header: String,
    /// Where the hunk sits in each side of the file, 1-based, as `@@` says.
    ///
    /// Carried across the seam rather than left in `header` because the
    /// reader needs the lines *between* two hunks — the unchanged body a
    /// reviewer occasionally has to see to judge the change — and computing
    /// that from a string means writing a second parser for these six
    /// characters on the other side, in a language with no tests over it.
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<Line>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    pub kind: LineKind,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    /// The default, and deliberately the dullest of the four: a header this
    /// parser did not recognise describes a file that exists and changed,
    /// which is true of every case it could have been.
    #[default]
    Modified,
    Added,
    Deleted,
    Renamed,
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
                    status: Status::Modified,
                    from: None,
                    hunks: Vec::new(),
                    fingerprint: String::new(),
                    fresh: true,
                });
                continue;
            }
            let Some(file) = files.last_mut() else {
                continue;
            };

            // Between `diff --git` and the first `@@`, git states what it
            // did to the file. Read before the hunk check below, because
            // after the first `@@` these words can only be file content.
            if file.hunks.is_empty()
                && let Some(what) = told(line)
            {
                match what {
                    Told::Status(s) => file.status = s,
                    Told::From(old) => {
                        file.status = Status::Renamed;
                        file.from = Some(old);
                    }
                }
                continue;
            }

            if line.starts_with("@@") {
                let (old_start, old_lines, new_start, new_lines) = spans(line);
                file.hunks.push(Hunk {
                    header: line.to_owned(),
                    old_start,
                    old_lines,
                    new_start,
                    new_lines,
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

/// What one of git's header lines says about the file, if anything.
enum Told {
    Status(Status),
    From(String),
}

/// Read a header line for what git did to the file.
///
/// Prefix matching rather than equality: the mode is part of the line
/// (`new file mode 100644`) and it varies, and a symlink or an executable
/// bit is still a new file.
fn told(line: &str) -> Option<Told> {
    if line.starts_with("new file mode") {
        return Some(Told::Status(Status::Added));
    }
    if line.starts_with("deleted file mode") {
        return Some(Told::Status(Status::Deleted));
    }
    // `rename from` rather than `rename to`: the path the reviewer opens is
    // already the new one, taken from the `diff --git` line, and what is
    // missing is where it came from.
    line.strip_prefix("rename from ")
        .map(|old| Told::From(old.to_owned()))
}

/// The two spans in `@@ -12,7 +12,9 @@`, as `(old start, old len, new start,
/// new len)`.
///
/// A missing length means one line — `@@ -1 +1 @@` is what git prints for a
/// single-line file — and reading that as zero makes the reader believe the
/// hunk covers nothing, which turns the gap above the next one into an
/// invitation to expand lines the hunk is already showing.
///
/// Anything unparseable gives zeroes rather than an error. This is text a
/// command printed, so the honest failure is a hunk that offers no expander,
/// not a review screen that refuses to open.
fn spans(header: &str) -> (usize, usize, usize, usize) {
    let mut it = header.split_whitespace().skip(1);
    let old = span(it.next().unwrap_or_default().strip_prefix('-'));
    let new = span(it.next().unwrap_or_default().strip_prefix('+'));
    (old.0, old.1, new.0, new.1)
}

fn span(s: Option<&str>) -> (usize, usize) {
    let Some(s) = s else { return (0, 0) };
    let (start, len) = s.split_once(',').unwrap_or((s, "1"));
    (
        start.parse().unwrap_or_default(),
        len.parse().unwrap_or_default(),
    )
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

    #[test]
    fn a_hunk_says_where_it_sits_in_both_sides() {
        let h = &Diff::parse(SAMPLE).files[0].hunks[0];
        assert_eq!((h.old_start, h.old_lines), (1, 3));
        assert_eq!((h.new_start, h.new_lines), (1, 4));
    }

    #[test]
    fn a_hunk_with_no_length_covers_one_line() {
        // `@@ -1 +1 @@` is what git prints for a single-line file. Read as
        // zero, the reader thinks the hunk shows nothing and offers to
        // expand the line it is already displaying.
        let h = &Diff::parse("diff --git a/a b/a\n@@ -1 +1 @@\n-x\n+y\n").files[0].hunks[0];
        assert_eq!((h.old_lines, h.new_lines), (1, 1));
    }

    #[test]
    fn a_new_file_starts_at_nothing_on_the_old_side() {
        let h = &Diff::parse("diff --git a/a b/a\n@@ -0,0 +1,2 @@\n+x\n+y\n").files[0].hunks[0];
        assert_eq!((h.old_start, h.old_lines), (0, 0));
        assert_eq!((h.new_start, h.new_lines), (1, 2));
    }

    #[test]
    fn the_function_name_git_appends_does_not_confuse_the_spans() {
        let h = &Diff::parse("diff --git a/a b/a\n@@ -4,2 +9,3 @@ fn open() {\n x\n+y\n").files[0]
            .hunks[0];
        assert_eq!((h.old_start, h.new_start), (4, 9));
    }

    #[test]
    fn an_unreadable_header_gives_zeroes_rather_than_refusing_the_file() {
        let h = &Diff::parse("diff --git a/a b/a\n@@ garbage @@\n+x\n").files[0].hunks[0];
        assert_eq!(
            (h.old_start, h.old_lines, h.new_start, h.new_lines),
            (0, 0, 0, 0)
        );
    }

    #[test]
    fn an_ordinary_edit_is_modified() {
        assert_eq!(Diff::parse(SAMPLE).files[0].status, Status::Modified);
    }

    #[test]
    fn a_new_file_says_so_rather_than_looking_like_a_large_edit() {
        let d = Diff::parse("diff --git a/a b/a\nnew file mode 100644\n@@ -0,0 +1 @@\n+x\n");
        assert_eq!(d.files[0].status, Status::Added);
    }

    #[test]
    fn a_deleted_file_says_so_rather_than_looking_like_a_large_cut() {
        // Both read as `-300`, and they are not the same news.
        let d = Diff::parse("diff --git a/a b/a\ndeleted file mode 100644\n@@ -1 +0,0 @@\n-x\n");
        assert_eq!(d.files[0].status, Status::Deleted);
    }

    #[test]
    fn a_rename_carries_where_the_file_used_to_be() {
        let d = Diff::parse(
            "diff --git a/old.rs b/new.rs\nsimilarity index 96%\nrename from old.rs\nrename to new.rs\n@@ -1 +1 @@\n-a\n+b\n",
        );
        assert_eq!(d.files[0].status, Status::Renamed);
        assert_eq!(d.files[0].from.as_deref(), Some("old.rs"));
        assert_eq!(d.files[0].path, "new.rs");
    }

    #[test]
    fn the_words_only_count_before_the_first_hunk() {
        // A file whose *content* contains `new file mode 100644` — this
        // parser's own test fixtures do. Read as a header it would relabel
        // an ordinary edit as an addition.
        let d = Diff::parse("diff --git a/a b/a\n@@ -1,2 +1,2 @@\n-old\n+new file mode 100644\n");
        assert_eq!(d.files[0].status, Status::Modified);
    }

    #[test]
    fn a_header_this_parser_does_not_know_leaves_the_file_modified() {
        // The dullest of the four answers, and true of every case it could
        // have been: the file exists and something in it changed.
        let d = Diff::parse("diff --git a/a b/a\nold mode 100644\n@@ -1 +1 @@\n-a\n+b\n");
        assert_eq!(d.files[0].status, Status::Modified);
        assert_eq!(d.files[0].from, None);
    }

    fn fingerprints(d: &Diff) -> HashMap<String, String> {
        d.files
            .iter()
            .map(|f| (f.path.clone(), f.fingerprint.clone()))
            .collect()
    }
    #[test]
    fn the_no_newline_marker_is_not_a_line_of_the_file() {
        // git prints `\ No newline at end of file` inside the hunk. Counting
        // it would add a context line the file does not have.
        let d = Diff::parse(
            "diff --git a/a b/a\n@@ -1 +1 @@\n-one\n\\ No newline at end of file\n+two\n",
        );
        assert_eq!((d.added(), d.removed()), (1, 1));
        assert_eq!(d.files[0].hunks[0].lines.len(), 2);
    }
}
