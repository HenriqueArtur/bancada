/// Whether the harness's state is visible on the host filesystem.
///
/// Reading the log from the host is a *fast path*, not the foundation. It
/// exists when the config directory is mounted; in a container with no
/// bind mount, or over SSH, it does not. `Piped` is more expensive, not
/// impossible — and naming it here is what stops the fast path from
/// becoming an assumption everything else is built on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FsAccess {
    /// Visible on the host: watch with filesystem events.
    Shared,
    /// Reachable only through the exec channel.
    Piped,
}

impl FsAccess {
    pub const fn can_watch_locally(self) -> bool {
        matches!(self, Self::Shared)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_shared_filesystem_can_be_watched_locally() {
        assert!(FsAccess::Shared.can_watch_locally());
        assert!(!FsAccess::Piped.can_watch_locally());
    }
}
