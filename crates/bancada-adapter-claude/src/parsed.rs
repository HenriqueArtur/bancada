use crate::Skip;
use bancada_events::Event;

/// What one log yielded: the events, and everything that produced none.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Parsed {
    pub events: Vec<Event>,
    pub skipped: Vec<Skip>,
}

impl Parsed {
    /// Skips whose type this parser has never seen.
    ///
    /// Separate from the total because the two mean different things: a
    /// known line carrying no event is expected forever, while an unknown
    /// type is the format having moved.
    pub fn unknown_types(&self) -> Vec<&str> {
        use crate::SkipReason::UnknownLineType;
        let mut v: Vec<&str> = self
            .skipped
            .iter()
            .filter_map(|s| match &s.reason {
                UnknownLineType(t) => Some(t.as_str()),
                _ => None,
            })
            .collect();
        v.sort_unstable();
        v.dedup();
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Skip;

    #[test]
    fn unknown_types_are_listed_once_each_and_sorted() {
        let p = Parsed {
            events: vec![],
            skipped: vec![
                Skip::unknown(1, "widget"),
                Skip::not_an_event(2, "ai-title"),
                Skip::unknown(3, "widget"),
                Skip::unknown(4, "gadget"),
            ],
        };
        assert_eq!(p.unknown_types(), vec!["gadget", "widget"]);
    }

    #[test]
    fn a_log_of_only_known_non_events_reports_no_unknown_types() {
        let p = Parsed {
            events: vec![],
            skipped: vec![Skip::not_an_event(1, "attachment")],
        };
        assert!(p.unknown_types().is_empty());
    }
}
