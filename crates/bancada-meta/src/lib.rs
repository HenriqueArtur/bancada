//! Metadata about a session, and nothing a session said.
//!
//! Hard rule 2 is that the rules engine never reads content. That is not
//! discipline here: this crate has no field that can hold any. The engine
//! depends on it and not on `bancada-events`, so reading content stops
//! being something to avoid and becomes something it cannot name.
mod decision_kind;
mod meta_event;
mod session_id;
mod timestamp;

pub use decision_kind::DecisionKind;
pub use meta_event::MetaEvent;
pub use session_id::SessionId;
pub use timestamp::Timestamp;
