//! Test doubles, in one place and out of the coverage report.
//!
//! Two problems, one answer. The same fake `Runtime` had been written four
//! times — in `cockpit`, `discovery`, `work` and `runtime` — each slightly
//! different and each drifting on its own. And a fake's unreached arms count
//! as uncovered *product* lines, so `cockpit.rs` read 86% while every branch
//! of its actual code was tested. Scaffolding was being scored as if it were
//! the building.
//!
//! Living in its own crate, this is excluded from the report by filename. A
//! hundred per cent now means no untested branch, rather than no unreached
//! line anywhere including the ladder.
mod runtime;

pub use runtime::{Answers, FakeRuntime};
