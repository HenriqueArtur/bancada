/// Milliseconds since the Unix epoch.
///
/// There is deliberately no `now()`. The ranking is a function of time, so
/// a clock reachable from inside would make the most important part of the
/// product the least testable — see `docs/SPIKES.md`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Timestamp(i64);

impl Timestamp {
    pub const fn from_millis(ms: i64) -> Self {
        Self(ms)
    }

    pub const fn as_millis(self) -> i64 {
        self.0
    }

    /// Milliseconds elapsed from `self` to `later`, saturating at zero.
    ///
    /// Saturating rather than signed: an event stamped after the clock we
    /// were handed is a clock problem, and an age that goes negative would
    /// silently reorder the queue instead of reporting.
    pub const fn elapsed_to(self, later: Self) -> i64 {
        if later.0 > self.0 {
            later.0 - self.0
        } else {
            0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn elapsed_measures_forward() {
        let a = Timestamp::from_millis(1_000);
        let b = Timestamp::from_millis(4_500);
        assert_eq!(a.elapsed_to(b), 3_500);
    }

    #[test]
    fn elapsed_saturates_instead_of_going_negative() {
        let a = Timestamp::from_millis(4_500);
        let b = Timestamp::from_millis(1_000);
        assert_eq!(a.elapsed_to(b), 0);
    }
}
