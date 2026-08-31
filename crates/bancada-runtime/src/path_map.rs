use std::path::{Path, PathBuf};

/// Translation between the host's spelling of a path and the guest's.
///
/// The host sees one path, the guest another, and the session log records
/// the guest's. Every path that crosses passes through here — paths inside
/// events, the working directory when starting a session, and the encoded
/// project directory name. It is mechanical, and it rots if it spreads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathMap {
    host_root: PathBuf,
    guest_root: PathBuf,
}

impl PathMap {
    pub fn new(host_root: impl Into<PathBuf>, guest_root: impl Into<PathBuf>) -> Self {
        Self {
            host_root: host_root.into(),
            guest_root: guest_root.into(),
        }
    }

    /// A guest path as the host spells it, or `None` when it is outside
    /// the mapped tree.
    ///
    /// `None` rather than the path unchanged: a path this map does not
    /// cover is not a path the host can open, and returning it would be a
    /// wrong answer that looks like a right one.
    pub fn to_host(&self, guest: &Path) -> Option<PathBuf> {
        guest
            .strip_prefix(&self.guest_root)
            .ok()
            .map(|rest| self.host_root.join(rest))
    }

    /// A host path as the guest spells it, or `None` when outside.
    pub fn to_guest(&self, host: &Path) -> Option<PathBuf> {
        host.strip_prefix(&self.host_root)
            .ok()
            .map(|rest| self.guest_root.join(rest))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn map() -> PathMap {
        PathMap::new("/Users/h/dev/personal", "/mnt/dev")
    }

    #[test]
    fn a_guest_path_becomes_the_host_spelling() {
        let got = map().to_host(Path::new("/mnt/dev/bancada/src/lib.rs"));
        assert_eq!(
            got,
            Some(PathBuf::from("/Users/h/dev/personal/bancada/src/lib.rs"))
        );
    }

    #[test]
    fn a_host_path_becomes_the_guest_spelling() {
        let got = map().to_guest(Path::new("/Users/h/dev/personal/bancada/Cargo.toml"));
        assert_eq!(got, Some(PathBuf::from("/mnt/dev/bancada/Cargo.toml")));
    }

    #[test]
    fn a_path_outside_the_mapped_tree_is_none_rather_than_unchanged() {
        assert_eq!(map().to_host(Path::new("/etc/passwd")), None);
        assert_eq!(map().to_guest(Path::new("/Users/h/other/x")), None);
    }

    #[test]
    fn the_two_directions_round_trip() {
        let m = map();
        let host = PathBuf::from("/Users/h/dev/personal/bancada/README.md");
        let guest = m.to_guest(&host).expect("mapped");
        assert_eq!(m.to_host(&guest), Some(host));
    }
}
