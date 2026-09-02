use bancada_runtime::{FsAccess, HostRuntime, PathMap};
use serde::{Deserialize, Serialize};

/// How to reach one place, as written in the configuration.
///
/// Deliberately not a list of known systems. A runtime is a command
/// prefix and a path mapping, so a VM, a container, a remote host and the
/// machine itself are the same shape with different words in it — and a
/// kind the product has never heard of costs no code.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSpec {
    pub id: String,
    /// `local`, `vm`, `container`, `ssh` — a label, not a switch.
    pub kind: String,
    /// What goes in front of every command. Empty for this machine.
    #[serde(default)]
    pub prefix: Vec<String>,
    /// Where the guest's tree is, as this machine spells it.
    #[serde(default = "root")]
    pub host_root: String,
    /// Where that same tree is, as the guest spells it.
    #[serde(default = "root")]
    pub guest_root: String,
    /// Where the harness keeps its state, as *this machine* spells it.
    /// The logs are read from here.
    pub config_dir: String,
    #[serde(default)]
    pub shared_fs: bool,
    /// Which harness runs here, and which model it is set to.
    ///
    /// Declared rather than probed. The probe can read a version off the
    /// binary but not which model you have it pointed at, and a header that
    /// named the harness and guessed the model would be right about the half
    /// nobody was asking about. `None` where you have not said.
    #[serde(default)]
    pub harness: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

fn root() -> String {
    "/".into()
}

impl RuntimeSpec {
    /// The reserved id of the machine bancada is running on.
    pub const THIS_MACHINE: &'static str = "this-machine";

    /// The machine bancada is running on, described without being told.
    ///
    /// A runtime is normally a declaration, because discovery proposing
    /// forty containers would hide the three that matter. This one is not a
    /// proposal: the product is *already* executing here, so its prefix is
    /// empty, its path mapping is the identity, and its filesystem is
    /// shared. There is nothing to be wrong about, and asking a person to
    /// write it down is asking them to restate a fact.
    ///
    /// `home` is passed in rather than read: nothing in this crate touches
    /// the environment, so the one ambient fact enters at the edge with the
    /// clock.
    pub fn this_machine(home: &std::path::Path) -> Self {
        Self {
            id: Self::THIS_MACHINE.to_owned(),
            kind: "local".to_owned(),
            prefix: Vec::new(),
            host_root: "/".to_owned(),
            guest_root: "/".to_owned(),
            config_dir: home.join(".claude").display().to_string(),
            shared_fs: true,
            // Not guessed. The machine bancada runs on may have no harness
            // on it at all, and a default naming one would put a word in
            // the header that nothing checked.
            harness: None,
            model: None,
        }
    }

    pub fn open(&self) -> HostRuntime {
        HostRuntime::prefixed(
            self.id.clone(),
            self.kind.clone(),
            self.prefix.clone(),
            PathMap::new(&self.host_root, &self.guest_root),
            if self.shared_fs {
                FsAccess::Shared
            } else {
                FsAccess::Piped
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bancada_runtime::Runtime;

    #[test]
    fn a_spec_with_no_prefix_reaches_this_machine() {
        let s: RuntimeSpec = serde_json::from_str(
            r#"{"id":"local","kind":"local","configDir":"/c","sharedFs":true}"#,
        )
        .unwrap();
        let r = s.open();
        assert_eq!(r.id(), "local");
        assert_eq!(r.exec(&["echo".into(), "hi".into()]).unwrap().trim(), "hi");
    }

    #[test]
    fn a_spec_without_shared_fs_is_piped_rather_than_assumed_readable() {
        let s: RuntimeSpec =
            serde_json::from_str(r#"{"id":"far","kind":"ssh","configDir":"/c"}"#).unwrap();
        assert_eq!(s.open().fs_access(), FsAccess::Piped);
    }
}
