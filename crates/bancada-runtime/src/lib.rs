//! Where a session executes, and how the product reaches it.
//!
//! Two levels: a provider knows how to reach a *class* of place; a runtime
//! is one concrete instance. Nothing above this crate calls `std::fs`
//! directly — that is hard rule 3, and it is what keeps the `piped` path
//! from being born impossible.
mod fs_access;
mod host_runtime;
mod path_map;
mod runtime;

pub use fs_access::FsAccess;
pub use host_runtime::HostRuntime;
pub use path_map::PathMap;
pub use runtime::{Runtime, RuntimeError};
