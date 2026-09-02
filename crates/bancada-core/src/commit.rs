use serde::Serialize;

/// One commit, as `git log` printed it.
///
/// Parsed from text like [`crate::Diff`] is, and for the same reason: the
/// project may run somewhere this process cannot reach the filesystem of, so
/// a command's output is the only thing to count on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub sha: String,
    pub short: String,
    pub author: String,
    /// Seconds since the epoch, as git counts them.
    ///
    /// A number and not a formatted string: how a date should read is the
    /// reader's locale and the reader's clock, and neither is knowable here.
    pub when: i64,
    pub subject: String,
}

/// A tab separates the fields, because git forbids control characters in the
/// author names it writes here — so the separator cannot appear inside a
/// field. A subject can hold one, which is why it is last and takes whatever
/// remains of the line.
pub const FIELDS: &str = "%H%x09%h%x09%an%x09%at%x09%s";

impl Commit {
    /// One `git log --format=FIELDS` line per commit.
    ///
    /// A line that does not parse is dropped rather than failing the list. A
    /// repository can carry a commit with a broken author date, and one bad
    /// row is not a reason to show none of them.
    pub fn parse(text: &str) -> Vec<Self> {
        text.lines().filter_map(Self::one).collect()
    }

    fn one(line: &str) -> Option<Self> {
        let mut it = line.splitn(5, '\t');
        let sha = it.next()?;
        let short = it.next()?;
        let author = it.next()?;
        let when = it.next()?.parse().ok()?;
        // A commit with an empty message is legal, so a missing fifth field
        // is a blank subject rather than a reason to drop the row.
        let subject = it.next().unwrap_or_default();
        if sha.is_empty() {
            return None;
        }
        Some(Commit {
            sha: sha.to_owned(),
            short: short.to_owned(),
            author: author.to_owned(),
            when,
            subject: subject.to_owned(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOG: &str = "f857b4b9\tf857b4b\tHenrique Artur\t1756742400\t🔏 | signed as itself\n3edc4601\t3edc460\tHenrique Artur\t1756656000\t🔔 | a window you must remember\n";

    #[test]
    fn a_log_becomes_commits_in_the_order_git_printed_them() {
        let got = Commit::parse(LOG);
        assert_eq!(got.len(), 2);
        assert_eq!(got[0].short, "f857b4b");
        assert_eq!(got[0].author, "Henrique Artur");
        assert_eq!(got[0].when, 1_756_742_400);
        assert_eq!(got[1].subject, "🔔 | a window you must remember");
    }

    #[test]
    fn a_subject_may_hold_the_separator() {
        // Which is why it is last and takes the rest of the line. A subject
        // with a tab in it would otherwise lose everything after it.
        let got = Commit::parse("a\tb\tc\t1\tfixed\tthe\tthing\n");
        assert_eq!(got[0].subject, "fixed\tthe\tthing");
    }

    #[test]
    fn a_commit_with_no_message_is_still_a_commit() {
        let got = Commit::parse("a\tb\tc\t1\n");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].subject, "");
    }

    #[test]
    fn a_row_that_does_not_parse_is_dropped_rather_than_failing_the_list() {
        let got = Commit::parse("noise\na\tb\tc\t1\tok\n");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].subject, "ok");
    }

    #[test]
    fn an_unreadable_date_drops_only_that_commit() {
        let got = Commit::parse("a\tb\tc\tnot-a-date\tone\nd\te\tf\t2\ttwo\n");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].subject, "two");
    }

    #[test]
    fn a_commit_with_no_hash_is_dropped_rather_than_offered() {
        // It would reach the list, get a row, and fail the moment somebody
        // clicked it. A row that cannot be opened is worse than no row.
        assert_eq!(Commit::parse("\tb\tc\t1\tsubject\n"), Vec::new());
    }

    #[test]
    fn no_output_is_no_commits_rather_than_an_error() {
        assert_eq!(Commit::parse(""), Vec::new());
    }
}
