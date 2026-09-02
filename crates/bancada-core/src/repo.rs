use serde::Serialize;

/// Where a project's working copy stands.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Repo {
    /// False for a directory git has never been told about. The product
    /// reads whatever tree a project points at, and plenty of them are not
    /// repositories — which is a state, not a failure.
    pub is_git: bool,
    /// The branch name, or `None` on a detached HEAD.
    pub head: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

/// `git rev-list --left-right --count @{upstream}...HEAD` → ahead, behind.
///
/// The argument order is worth writing down: `--left-right` puts the
/// upstream on the left, so the left count is what you are missing and the
/// right is what you have not pushed. Read the other way round, the two
/// numbers are a confident lie about which way the work is going.
pub fn tracking(text: &str) -> (usize, usize) {
    let mut it = text.split_whitespace();
    let behind = it.next().and_then(|n| n.parse().ok()).unwrap_or_default();
    let ahead = it.next().and_then(|n| n.parse().ok()).unwrap_or_default();
    (ahead, behind)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracking_reads_behind_first_and_ahead_second() {
        assert_eq!(tracking("3\t7\n"), (7, 3));
    }

    #[test]
    fn no_upstream_is_level_rather_than_an_error() {
        assert_eq!(tracking(""), (0, 0));
    }

    #[test]
    fn a_directory_with_no_repository_is_the_default() {
        assert_eq!(
            Repo::default(),
            Repo {
                is_git: false,
                head: None,
                ahead: 0,
                behind: 0
            }
        );
    }
}
