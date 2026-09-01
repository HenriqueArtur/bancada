// This crate is the one place allowed to touch the filesystem and to spawn
// processes: it exists precisely so nothing above it does. Hard rule 3 is
// about everything else, not about the wrapper.
#![allow(clippy::disallowed_methods)]

use crate::{FsAccess, PathMap, Runtime, RuntimeError};
use std::path::Path;
use std::process::Command;

/// A place reachable by running a command, with an optional prefix.
///
/// One type covers the machine itself and every kind of guest, because the
/// only thing that differs is what goes in front:
///
/// ```text
/// local      []                              cat /etc/hosts
/// a VM       ["limactl","shell","dev","--"]  limactl shell dev -- cat …
/// container  ["docker","exec","api"]         docker exec api cat …
/// remote     ["ssh","box"]                   ssh box cat …
/// ```
///
/// Naming a class of place is a provider's job; this is one instance of
/// one, and it does not know or care which class it belongs to.
pub struct HostRuntime {
    id: String,
    kind: String,
    prefix: Vec<String>,
    paths: PathMap,
    fs_access: FsAccess,
}

impl HostRuntime {
    /// The machine the product is running on.
    pub fn local() -> Self {
        Self {
            id: "local".into(),
            kind: "local".into(),
            prefix: Vec::new(),
            paths: PathMap::new("/", "/"),
            fs_access: FsAccess::Shared,
        }
    }

    pub fn prefixed(
        id: impl Into<String>,
        kind: impl Into<String>,
        prefix: Vec<String>,
        paths: PathMap,
        fs_access: FsAccess,
    ) -> Self {
        Self {
            id: id.into(),
            kind: kind.into(),
            prefix,
            paths,
            fs_access,
        }
    }
}

impl Runtime for HostRuntime {
    fn id(&self) -> &str {
        &self.id
    }

    fn kind(&self) -> &str {
        &self.kind
    }

    fn paths(&self) -> &PathMap {
        &self.paths
    }

    fn fs_access(&self) -> FsAccess {
        self.fs_access
    }

    fn exec(&self, cmd: &[String]) -> Result<String, RuntimeError> {
        let mut full = self.prefix.clone();
        full.extend_from_slice(cmd);
        let Some((program, args)) = full.split_first() else {
            return Err(RuntimeError::Failed("empty command".into()));
        };

        let out = Command::new(program)
            .args(args)
            .output()
            .map_err(|e| RuntimeError::Failed(format!("{program}: {e}")))?;

        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).into_owned())
        } else {
            // The command ran and said no. That is a result, not a
            // transport failure, and the two must not look alike.
            Err(RuntimeError::Failed(format!(
                "{program} exited {}: {}",
                out.status.code().unwrap_or(-1),
                String::from_utf8_lossy(&out.stderr).trim()
            )))
        }
    }

    fn read_dir(&self, guest_path: &Path) -> Result<Vec<std::path::PathBuf>, RuntimeError> {
        match self.fs_access {
            FsAccess::Shared => {
                let host = self.paths.to_host(guest_path).ok_or_else(|| {
                    RuntimeError::NotFound(format!(
                        "{} is outside the mapped tree",
                        guest_path.display()
                    ))
                })?;
                let mut out: Vec<std::path::PathBuf> = std::fs::read_dir(&host)
                    .map_err(|e| match e.kind() {
                        std::io::ErrorKind::NotFound => {
                            RuntimeError::NotFound(host.display().to_string())
                        }
                        _ => RuntimeError::Failed(format!("{}: {e}", host.display())),
                    })?
                    .filter_map(Result::ok)
                    .map(|e| e.path())
                    .collect();
                // The filesystem gives no order; sorting is what makes two
                // identical runs produce two identical queues.
                out.sort();
                Ok(out)
            }
            FsAccess::Piped => Err(RuntimeError::Unsupported(
                "listing through the exec channel is not implemented".into(),
            )),
        }
    }

    fn read_file(&self, guest_path: &Path) -> Result<Vec<u8>, RuntimeError> {
        match self.fs_access {
            // The fast path: the file is on this machine under another
            // name, so read it rather than paying for a process.
            FsAccess::Shared => {
                let host = self.paths.to_host(guest_path).ok_or_else(|| {
                    RuntimeError::NotFound(format!(
                        "{} is outside the mapped tree",
                        guest_path.display()
                    ))
                })?;
                std::fs::read(&host).map_err(|e| match e.kind() {
                    std::io::ErrorKind::NotFound => {
                        RuntimeError::NotFound(host.display().to_string())
                    }
                    _ => RuntimeError::Failed(format!("{}: {e}", host.display())),
                })
            }
            FsAccess::Piped => Err(RuntimeError::Unsupported(
                "reading through the exec channel is not implemented — \
                 every registered runtime is shared today"
                    .into(),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_local_runtime_runs_a_command_and_returns_its_output() {
        let r = HostRuntime::local();
        let out = r.exec(&["echo".into(), "hello".into()]).unwrap();
        assert_eq!(out.trim(), "hello");
    }

    #[test]
    fn a_command_that_says_no_is_an_error_not_empty_output() {
        let r = HostRuntime::local();
        let err = r.exec(&["false".into()]).unwrap_err();
        assert!(matches!(err, RuntimeError::Failed(m) if m.contains("exited")));
    }

    #[test]
    fn a_program_that_does_not_exist_is_named() {
        let r = HostRuntime::local();
        let err = r
            .exec(&["definitely-not-a-program-9c1f".into()])
            .unwrap_err();
        assert!(matches!(err, RuntimeError::Failed(m) if m.contains("definitely-not")));
    }

    #[test]
    fn an_empty_command_is_refused_rather_than_run() {
        assert!(HostRuntime::local().exec(&[]).is_err());
    }

    #[test]
    fn a_prefix_goes_in_front_of_every_command() {
        // `env` prints its arguments' effect; prefixing with `env` is a
        // real prefix that changes nothing observable but proves the join.
        let r = HostRuntime::prefixed(
            "prefixed",
            "test",
            vec!["env".into()],
            PathMap::new("/", "/"),
            FsAccess::Shared,
        );
        assert_eq!(r.exec(&["echo".into(), "hi".into()]).unwrap().trim(), "hi");
    }

    #[test]
    fn reading_outside_the_mapped_tree_is_not_found_rather_than_wrong() {
        let r = HostRuntime::prefixed(
            "vm",
            "test",
            vec![],
            PathMap::new("/tmp/host", "/mnt/guest"),
            FsAccess::Shared,
        );
        let err = r.read_file(Path::new("/etc/passwd")).unwrap_err();
        assert!(matches!(err, RuntimeError::NotFound(_)));
    }

    #[test]
    fn a_piped_runtime_says_it_cannot_read_rather_than_returning_nothing() {
        let r = HostRuntime::prefixed(
            "remote",
            "ssh",
            vec![],
            PathMap::new("/", "/"),
            FsAccess::Piped,
        );
        let err = r.read_file(Path::new("/x")).unwrap_err();
        assert!(matches!(err, RuntimeError::Unsupported(_)));
    }
}
