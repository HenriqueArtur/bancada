//! Wiring: configuration, discovery, and the pipeline that turns logs into
//! the queue.
//!
//! This crate knows about every layer, which is exactly why no other crate
//! does. It is the only place a harness adapter, a runtime and the rules
//! engine appear in the same file.
mod cockpit;
mod config;
mod diff;
mod discovery;
mod glance;
mod project;
mod review;
mod runtime_spec;
mod work;
mod workspace;

pub use cockpit::Cockpit;
pub use config::{Config, ConfigError};
pub use diff::{Diff, FileDiff, Hunk, Line, LineKind};
pub use discovery::{Account, Discovery, Harness};
pub use glance::Glance;
pub use project::Project;
pub use review::Review;
pub use runtime_spec::RuntimeSpec;
pub use work::{Grouped, Standing, Work};
pub use workspace::{Export, Workspace};
