use crate::{FsAccess, PathMap};
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeError {
    /// The operation needs a capability this runtime does not have.
    ///
    /// Named rather than silent: a `piped` runtime asked to watch locally
    /// should say so, because a watch that reports nothing is
    /// indistinguishable from a tree that is not changing.
    Unsupported(String),
    NotFound(String),
    Failed(String),
}

/// One concrete place a session can execute.
///
/// Everything above this trait reaches the filesystem through it and never
/// through `std::fs`. That is what lets a runtime without a shared
/// filesystem exist at all.
pub trait Runtime {
    fn id(&self) -> &str;
    /// Which class of place this is: `local`, `vm`, `container`, `ssh`.
    fn kind(&self) -> &str;
    fn paths(&self) -> &PathMap;
    fn fs_access(&self) -> FsAccess;

    /// Run a command to completion and return its standard output.
    fn exec(&self, cmd: &[String]) -> Result<String, RuntimeError>;

    /// Read a file, addressed in the guest's spelling.
    fn read_file(&self, guest_path: &Path) -> Result<Vec<u8>, RuntimeError>;

    /// List a directory's entries, addressed in the guest's spelling.
    ///
    /// Returned in a stable order, because a queue that reorders itself
    /// between two identical runs is a queue nobody can trust.
    fn read_dir(&self, guest_path: &Path) -> Result<Vec<std::path::PathBuf>, RuntimeError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fake {
        access: FsAccess,
        paths: PathMap,
    }

    impl Runtime for Fake {
        fn id(&self) -> &str {
            "fake"
        }
        fn kind(&self) -> &str {
            "fake"
        }
        fn paths(&self) -> &PathMap {
            &self.paths
        }
        fn fs_access(&self) -> FsAccess {
            self.access
        }
        fn exec(&self, cmd: &[String]) -> Result<String, RuntimeError> {
            Ok(cmd.join(" "))
        }
        fn read_dir(&self, guest_path: &Path) -> Result<Vec<std::path::PathBuf>, RuntimeError> {
            Err(RuntimeError::NotFound(guest_path.display().to_string()))
        }

        fn read_file(&self, guest_path: &Path) -> Result<Vec<u8>, RuntimeError> {
            if guest_path == Path::new("/mnt/dev/a.txt") {
                Ok(b"hello".to_vec())
            } else {
                Err(RuntimeError::NotFound(guest_path.display().to_string()))
            }
        }
    }

    fn fake(access: FsAccess) -> Fake {
        Fake {
            access,
            paths: PathMap::new("/host", "/mnt/dev"),
        }
    }

    #[test]
    fn a_fake_runtime_satisfies_the_trait() {
        let r = fake(FsAccess::Shared);
        assert_eq!(r.id(), "fake");
        assert_eq!(r.exec(&["echo".into(), "hi".into()]).unwrap(), "echo hi");
    }

    #[test]
    fn a_missing_file_is_named_rather_than_empty() {
        let r = fake(FsAccess::Shared);
        let err = r.read_file(Path::new("/mnt/dev/nope")).unwrap_err();
        assert!(matches!(err, RuntimeError::NotFound(p) if p.contains("nope")));
    }

    #[test]
    fn a_piped_runtime_reports_that_it_cannot_watch_locally() {
        assert!(!fake(FsAccess::Piped).fs_access().can_watch_locally());
    }
}
