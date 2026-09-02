use serde::Serialize;

/// How much has moved in a project, in three numbers.
///
/// Its own type rather than a tuple: the footer shows these on every screen,
/// and three bare `usize` in a row is exactly the signature somebody swaps
/// two arguments of.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub files: usize,
    pub added: usize,
    pub removed: usize,
    /// Whether git has been told about this tree at all.
    ///
    /// False and three zeroes are not the same fact. "Nothing uncommitted"
    /// is a claim about a repository, and a project pointed at a plain
    /// directory has none to make it about.
    pub versioned: bool,
}
