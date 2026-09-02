//! Wiring: configuration, discovery, and the pipeline that turns logs into
//! the queue.
//!
//! This crate knows about every layer, which is exactly why no other crate
//! does. It is the only place a harness adapter, a runtime and the rules
//! engine appear in the same file.
mod branch;
mod chat;
mod cockpit;
mod commit;
mod config;
mod diff;
mod discovery;
mod glance;
mod project;
mod repo;
mod review;
mod runtime_spec;
mod session;
mod summary;
mod work;
mod workspace;
mod worktree;

pub use branch::Branch;
pub use chat::{Chat, Said, Step};
pub use cockpit::Cockpit;
pub use commit::{Commit, FIELDS};
pub use config::{Config, ConfigError};
pub use diff::{Diff, FileDiff, Hunk, Line, LineKind, Status};
pub use discovery::{Account, Discovery, Harness};
pub use glance::Glance;
pub use project::Project;
pub use repo::{Repo, tracking};
pub use review::{Episode, Review};
pub use runtime_spec::RuntimeSpec;
pub use session::Session;
pub use summary::Summary;
pub use work::{Grouped, Standing, Work};
pub use workspace::{Export, Workspace};
pub use worktree::{Track, Worktree};
