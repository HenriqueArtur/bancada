//! The full event model, content included.
//!
//! Everything above the adapter reads this; the rules engine does not
//! depend on this crate at all. The projection to `MetaEvent` is the only
//! way a fact crosses from here into the engine.
mod event;
mod question;

pub use event::{Event, Role};
pub use question::{Question, QuestionOption};
