use serde::Serialize;

/// One branch, and whether it is the one you are on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub name: String,
    pub head: String,
    /// Exactly one is true in a normal repository, and none is true with a
    /// detached HEAD — which is a state worth seeing rather than hiding.
    pub current: bool,
}

impl Branch {
    /// One `git branch --format=%(HEAD)%09%(refname:short)%09%(objectname:short)`
    /// line per branch.
    ///
    /// A tab separates the fields because git forbids control characters in
    /// ref names, so the separator cannot appear inside one.
    pub fn parse(text: &str) -> Vec<Self> {
        text.lines()
            .filter_map(|line| {
                let mut it = line.splitn(3, '\t');
                let current = it.next()? == "*";
                let name = it.next()?;
                let head = it.next().unwrap_or_default();
                if name.is_empty() {
                    return None;
                }
                Some(Branch {
                    name: name.to_owned(),
                    head: head.to_owned(),
                    current,
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn branches_say_which_one_you_are_on() {
        let got = Branch::parse("*\tmain\tf857b4b\n \tfeat/a-mark\t6fb2b11\n");
        assert_eq!(got.len(), 2);
        assert!(got[0].current);
        assert_eq!(got[0].name, "main");
        assert!(!got[1].current);
        assert_eq!(got[1].head, "6fb2b11");
    }

    #[test]
    fn a_detached_head_leaves_no_branch_current() {
        // Worth seeing rather than hiding: work committed here is reachable
        // from nothing, and the branch list is where that shows.
        let got = Branch::parse(" \tmain\tf857b4b\n");
        assert!(!got.iter().any(|b| b.current));
    }

    #[test]
    fn a_branch_with_no_name_is_dropped_rather_than_offered() {
        assert_eq!(Branch::parse("*\t\tf857b4b\n"), Vec::new());
    }

    #[test]
    fn no_output_is_no_branches_rather_than_an_error() {
        assert_eq!(Branch::parse(""), Vec::new());
    }
}
