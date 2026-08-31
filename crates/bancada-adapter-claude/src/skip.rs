/// A line that produced no event, with the reason named.
///
/// Never silent. A parser that reports nothing is indistinguishable from a
/// log that contained nothing, and this format changes between harness
/// versions without warning — the count is how a change announces itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skip {
    /// 1-based, so it matches what an editor shows.
    pub line: usize,
    pub reason: SkipReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SkipReason {
    /// A line type this parser has never seen.
    UnknownLineType(String),
    /// Valid JSON, a known type, and carrying no event we model.
    NotAnEvent(String),
    /// Not valid JSON. Expected while a file is being written.
    Malformed(String),
}

impl Skip {
    pub fn unknown(line: usize, kind: impl Into<String>) -> Self {
        Self {
            line,
            reason: SkipReason::UnknownLineType(kind.into()),
        }
    }
    pub fn not_an_event(line: usize, kind: impl Into<String>) -> Self {
        Self {
            line,
            reason: SkipReason::NotAnEvent(kind.into()),
        }
    }
    pub fn malformed(line: usize, why: impl Into<String>) -> Self {
        Self {
            line,
            reason: SkipReason::Malformed(why.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_skip_names_the_line_it_came_from() {
        let s = Skip::unknown(42, "widget");
        assert_eq!(s.line, 42);
        assert_eq!(s.reason, SkipReason::UnknownLineType("widget".into()));
    }

    #[test]
    fn the_three_reasons_are_distinguishable() {
        assert_ne!(
            Skip::unknown(1, "x").reason,
            Skip::not_an_event(1, "x").reason
        );
        assert_ne!(
            Skip::not_an_event(1, "x").reason,
            Skip::malformed(1, "x").reason
        );
    }
}
