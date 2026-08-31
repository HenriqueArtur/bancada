//! Read one harness's session log and produce normalised events.
//!
//! Everything harness-specific stops here. Nothing above this crate knows
//! what a `tool_use` block is, or that a log is JSON lines at all.
//!
//! The format is internal and undocumented, so this crate is written
//! against recorded fixtures and is **permissive by construction**: an
//! unknown field is ignored, an unknown line type is counted and named,
//! and a malformed line costs that line and nothing after it.
mod parsed;
mod session_log;
mod skip;

pub use parsed::Parsed;
pub use session_log::SessionLog;
pub use skip::{Skip, SkipReason};
