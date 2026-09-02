// The whole surface the webview can reach, in one folder.
//
// `pub mod` rather than a re-export: the command macro generates a hidden
// sibling that `generate_handler!` resolves by path, and a tidy `pub use`
// silently hides it.
pub mod attention;
pub mod git;
pub mod preview;
pub mod queue;
pub mod review;
pub mod sessions;
pub mod setup;
pub mod tree;
pub mod work;
