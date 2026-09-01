use crate::RuntimeSpec;
use bancada_runtime::Runtime;
use serde::{Deserialize, Serialize};

/// What a runtime turned out to have.
///
/// Discovery **proposes**; registration is yours. Nothing found here
/// reaches the queue on its own — forty containers would hide the three
/// that matter.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Discovery {
    pub runtime: String,
    pub harness: Option<Harness>,
    /// Named rather than silent. A runtime that could not be probed looks
    /// exactly like one with nothing installed.
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Harness {
    pub path: String,
    pub version: String,
    pub logged_in: bool,
    /// Read, never typed. The machine knows which account it is; only you
    /// know whose work it is.
    pub account: Option<Account>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub uuid: String,
    pub email: String,
    pub organization: String,
}

impl Discovery {
    /// Probe one runtime.
    ///
    /// The lookup runs in a **login shell** on purpose: binary paths differ
    /// per runtime and version managers do not exist in a non-interactive
    /// one, so `command -v` would answer "absent" about something present.
    pub fn probe(spec: &RuntimeSpec, r: &dyn Runtime) -> Self {
        let mut out = Self {
            runtime: spec.id.clone(),
            harness: None,
            error: None,
        };

        let path = match r.exec(&["bash".into(), "-lc".into(), "command -v claude".into()]) {
            Ok(p) if !p.trim().is_empty() => p.trim().to_owned(),
            Ok(_) => return out,
            Err(e) => {
                out.error = Some(format!("{e:?}"));
                return out;
            }
        };

        let version = r
            .exec(&["bash".into(), "-lc".into(), "claude --version".into()])
            .map(|v| v.trim().to_owned())
            .unwrap_or_default();

        let status = r
            .exec(&["bash".into(), "-lc".into(), "claude auth status".into()])
            .unwrap_or_default();
        let logged_in = status.contains("\"loggedIn\": true");

        out.harness = Some(Harness {
            path,
            version,
            logged_in,
            account: read_account(spec, r),
        });
        out
    }
}

/// The account identity, from the harness's own configuration.
///
/// This is what turns the workspace boundary from a promise into a fact:
/// two runtimes reporting one `uuid` are sharing an account, and the
/// product sees it rather than depending on being told.
fn read_account(spec: &RuntimeSpec, r: &dyn Runtime) -> Option<Account> {
    let raw = r
        .read_file(std::path::Path::new(&format!(
            "{}/.claude.json",
            spec.config_dir
        )))
        .ok()?;
    let v: serde_json::Value = serde_json::from_slice(&raw).ok()?;
    let a = v.get("oauthAccount")?;
    let s = |k: &str| {
        a.get(k)
            .and_then(|x| x.as_str())
            .unwrap_or_default()
            .to_owned()
    };
    Some(Account {
        uuid: s("accountUuid"),
        email: s("emailAddress"),
        organization: s("organizationName"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use bancada_runtime::{FsAccess, PathMap, RuntimeError};
    use std::path::{Path, PathBuf};

    struct Fake {
        has_claude: bool,
        fails: bool,
    }

    impl Runtime for Fake {
        fn id(&self) -> &str {
            "fake"
        }
        fn kind(&self) -> &str {
            "fake"
        }
        fn paths(&self) -> &'static PathMap {
            Box::leak(Box::new(PathMap::new("/", "/")))
        }
        fn fs_access(&self) -> FsAccess {
            FsAccess::Shared
        }
        fn exec(&self, cmd: &[String]) -> Result<String, RuntimeError> {
            if self.fails {
                return Err(RuntimeError::Failed("unreachable".into()));
            }
            let line = cmd.join(" ");
            Ok(match () {
                _ if line.contains("command -v") && self.has_claude => "/usr/bin/claude".into(),
                _ if line.contains("command -v") => String::new(),
                _ if line.contains("--version") => "2.1.221 (Claude Code)".into(),
                _ if line.contains("auth status") => "{\"loggedIn\": true}".into(),
                _ => String::new(),
            })
        }
        fn modified(&self, _: &Path) -> Option<i64> {
            None
        }
        fn read_dir(&self, _: &Path) -> Result<Vec<PathBuf>, RuntimeError> {
            Ok(Vec::new())
        }
        fn read_file(&self, _: &Path) -> Result<Vec<u8>, RuntimeError> {
            Ok(br#"{"oauthAccount":{"accountUuid":"u1","emailAddress":"a@b.c","organizationName":"Org"}}"#.to_vec())
        }
    }

    fn spec() -> RuntimeSpec {
        serde_json::from_str(r#"{"id":"r","kind":"vm","configDir":"/c","sharedFs":true}"#).unwrap()
    }

    #[test]
    fn a_runtime_with_the_harness_reports_its_version_and_account() {
        let d = Discovery::probe(
            &spec(),
            &Fake {
                has_claude: true,
                fails: false,
            },
        );
        let h = d.harness.expect("harness");
        assert_eq!(h.path, "/usr/bin/claude");
        assert!(h.logged_in);
        assert_eq!(h.account.unwrap().organization, "Org");
    }

    #[test]
    fn a_runtime_without_the_harness_reports_nothing_rather_than_failing() {
        let d = Discovery::probe(
            &spec(),
            &Fake {
                has_claude: false,
                fails: false,
            },
        );
        assert!(d.harness.is_none());
        assert!(d.error.is_none(), "absent is not an error");
    }

    #[test]
    fn a_runtime_that_cannot_be_reached_says_so_instead_of_looking_empty() {
        let d = Discovery::probe(
            &spec(),
            &Fake {
                has_claude: true,
                fails: true,
            },
        );
        assert!(d.harness.is_none());
        assert!(
            d.error.is_some(),
            "unreachable looked like nothing installed"
        );
    }
}
