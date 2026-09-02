use serde::Serialize;
use std::collections::BTreeMap;

/// What git says about each path in a working tree.
///
/// One `git status --porcelain --ignored` per project rather than a question
/// per file: the tree pane lists a directory at a time and would otherwise
/// ask once per row, and the answer is the same command every time.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    /// Path to what happened to it, relative to the project root.
    pub files: BTreeMap<String, Track>,
    /// Directories git reported wholesale, without their trailing slash.
    ///
    /// Separate because they mean something different: an ignored `target/`
    /// comes back as one entry standing for everything beneath it, and a
    /// reader asking about `target/debug/x` has to be told by the prefix
    /// rather than by an entry of its own — there are forty thousand of
    /// those and git deliberately does not print them.
    pub dirs: BTreeMap<String, Track>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Track {
    Modified,
    Added,
    Deleted,
    Renamed,
    /// Git has never been told about it. Its own state and not "added",
    /// because nothing has been staged and nothing will be committed.
    Untracked,
    Ignored,
    /// A merge left both sides in the file. The one state where opening the
    /// file is not optional.
    Conflicted,
}

impl Worktree {
    /// Parse `git status --porcelain --ignored`.
    ///
    /// The short format, not `-z`: `--porcelain` is the one git promises not
    /// to change between versions, and the quoting it applies to odd paths
    /// is undone below.
    pub fn parse(text: &str) -> Self {
        let mut out = Worktree::default();
        for line in text.lines() {
            // `XY path`, with the code always two columns wide.
            if line.len() < 4 {
                continue;
            }
            let (code, rest) = line.split_at(2);
            let path = unquote(rest.trim_start());
            let Some(track) = read(code) else { continue };

            // A rename prints `old -> new`. The reader opens the new one.
            let path = path.rsplit(" -> ").next().unwrap_or(&path).to_owned();

            match path.strip_suffix('/') {
                Some(dir) => out.dirs.insert(dir.to_owned(), track),
                None => out.files.insert(path, track),
            };
        }
        out
    }

    /// What happened to one path, or `None` for one git has nothing to say
    /// about.
    ///
    /// Checks the directories it sits under as well as itself, because an
    /// ignored directory stands for every path beneath it and none of those
    /// has an entry.
    pub fn of(&self, path: &str) -> Option<Track> {
        if let Some(t) = self.files.get(path).or_else(|| self.dirs.get(path)) {
            return Some(*t);
        }
        let mut at = path;
        while let Some(cut) = at.rfind('/') {
            at = &at[..cut];
            if let Some(t) = self.dirs.get(at) {
                return Some(*t);
            }
        }
        None
    }
}

/// The two-column code, read for the one thing worth colouring a row with.
///
/// Order matters. A file can be added in the index and modified in the tree
/// (`AM`), and the news is that it is new. Conflict outranks everything: it
/// is the one state where opening the file is not optional.
fn read(code: &str) -> Option<Track> {
    let mut it = code.chars();
    let x = it.next()?;
    let y = it.next()?;
    Some(match (x, y) {
        ('!', '!') => Track::Ignored,
        ('?', '?') => Track::Untracked,
        ('U', _) | (_, 'U') | ('A', 'A') | ('D', 'D') => Track::Conflicted,
        ('R', _) => Track::Renamed,
        ('A', _) => Track::Added,
        ('D', _) | (_, 'D') => Track::Deleted,
        (' ', ' ') => return None,
        _ => Track::Modified,
    })
}

/// Undo the quoting git applies to a path with something odd in it.
///
/// Deliberately shallow: the quotes come off and `\"` and `\\` are undone.
/// A path with an octal escape in it is left as git wrote it, which is
/// wrong-looking and still findable — better than a path this function
/// decoded incorrectly and nobody can match against the tree.
fn unquote(path: &str) -> String {
    let Some(inner) = path.strip_prefix('"').and_then(|p| p.strip_suffix('"')) else {
        return path.to_owned();
    };
    inner.replace("\\\"", "\"").replace("\\\\", "\\")
}

#[cfg(test)]
mod tests {
    use super::*;

    const STATUS: &str = concat!(
        " M web/src/app.tsx\n",
        "?? web/src/core/git.ts\n",
        "A  crates/bancada-core/src/worktree.rs\n",
        " D old.rs\n",
        "R  from.rs -> to.rs\n",
        "!! target/\n",
        "!! web/node_modules/\n",
    );

    #[test]
    fn each_code_becomes_the_state_worth_colouring_a_row_with() {
        let w = Worktree::parse(STATUS);
        assert_eq!(w.of("web/src/app.tsx"), Some(Track::Modified));
        assert_eq!(w.of("web/src/core/git.ts"), Some(Track::Untracked));
        assert_eq!(
            w.of("crates/bancada-core/src/worktree.rs"),
            Some(Track::Added)
        );
        assert_eq!(w.of("old.rs"), Some(Track::Deleted));
    }

    #[test]
    fn a_rename_is_filed_under_where_the_file_is_now() {
        let w = Worktree::parse(STATUS);
        assert_eq!(w.of("to.rs"), Some(Track::Renamed));
        assert_eq!(w.of("from.rs"), None, "the old path is gone");
    }

    #[test]
    fn an_ignored_directory_stands_for_everything_under_it() {
        // This is the whole reason `dirs` is separate. `target/` is one line
        // and forty thousand paths, and git deliberately prints none of them.
        let w = Worktree::parse(STATUS);
        assert_eq!(w.of("target"), Some(Track::Ignored));
        assert_eq!(w.of("target/debug/deps/x.rlib"), Some(Track::Ignored));
        assert_eq!(
            w.of("web/node_modules/react/index.js"),
            Some(Track::Ignored)
        );
    }

    #[test]
    fn a_path_git_has_nothing_to_say_about_is_none() {
        let w = Worktree::parse(STATUS);
        assert_eq!(w.of("README.md"), None);
        assert_eq!(w.of("web/src/main.tsx"), None);
    }

    #[test]
    fn a_directory_named_like_an_ignored_one_is_not_ignored() {
        // `targeting/x.rs` starts with the letters of `target` and is not
        // inside it. Matching on the prefix rather than the segment would
        // grey out a file somebody is working in.
        let w = Worktree::parse("!! target/\n");
        assert_eq!(w.of("targeting/x.rs"), None);
    }

    #[test]
    fn being_new_outranks_also_being_edited() {
        // `AM` is staged as new and changed again since. The news is that it
        // is new.
        assert_eq!(Worktree::parse("AM x.rs\n").of("x.rs"), Some(Track::Added));
    }

    #[test]
    fn a_conflict_outranks_everything() {
        // The one state where opening the file is not optional.
        for code in ["UU", "AA", "DD", "AU", "UD"] {
            let w = Worktree::parse(&format!("{code} x.rs\n"));
            assert_eq!(w.of("x.rs"), Some(Track::Conflicted), "{code}");
        }
    }

    #[test]
    fn a_quoted_path_is_unquoted_so_it_matches_the_tree() {
        let w = Worktree::parse("?? \"a file with spaces.rs\"\n");
        assert_eq!(w.of("a file with spaces.rs"), Some(Track::Untracked));
    }

    #[test]
    fn a_row_with_no_code_at_all_is_not_a_state() {
        // `git status` does not print one, but the parser reads whatever the
        // runtime handed back. An empty code filed as "modified" would
        // colour a row for a change that is not there.
        assert_eq!(Worktree::parse("   x.rs\n"), Worktree::default());
    }

    #[test]
    fn a_line_too_short_to_hold_a_code_is_skipped() {
        assert_eq!(Worktree::parse("x\n\n"), Worktree::default());
    }

    #[test]
    fn a_clean_tree_says_nothing_rather_than_failing() {
        assert_eq!(Worktree::parse(""), Worktree::default());
        assert_eq!(Worktree::default().of("anything"), None);
    }
}
