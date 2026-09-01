//! The rules engine: deterministic, no AI, metadata only.
//!
//! This crate depends on `bancada-meta` and **not** on `bancada-events`.
//! Hard rule 2 is therefore not a convention anyone has to remember —
//! there is no type reachable from here that can hold what a session said.
//! Adding `bancada-events` to `Cargo.toml` is the whole violation, and it
//! is visible in a diff.
//!
//! Nothing here reads a clock. Every function that needs the current time
//! is handed it, because the ranking is a function of time and an ambient
//! clock would make the most important part of the product the least
//! testable.
mod grouped;
mod pending;
mod queue_item;
mod ranked;
mod session_state;
mod wip;

pub use grouped::{Grouped, group};
pub use pending::Pending;
pub use queue_item::QueueItem;
pub use ranked::{Ranked, rank};
pub use session_state::SessionState;
pub use wip::Wip;
