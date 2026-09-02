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
    pub fn probe(spec: &RuntimeSpec, r: &dyn Runtime) -> Self {
        let mut out = Self {
            runtime: spec.id.clone(),
            harness: None,
            error: None,
        };

        let path = match ask(r, "command -v claude") {
            Ok(p) if !p.trim().is_empty() => p.trim().to_owned(),
            // Ran, and found nothing. Not a failure — plenty of machines
            // have no harness on them, and the screen has a phrase for it.
            Ok(_) => return out,
            Err(e) => {
                out.error = Some(format!("{e:?}"));
                return out;
            }
        };

        let version = ask(r, "claude --version")
            .map(|v| v.trim().to_owned())
            .unwrap_or_default();

        let status = ask(r, "claude auth status").unwrap_or_default();
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

/// Ask a runtime's own shell, and let "no" come back as an answer.
///
/// **Interactive as well as login.** A version manager puts the harness on
/// `PATH` from the interactive rc, and a login shell never reads that one:
/// this shipped as `bash -lc`, and it reported `bash exited 1` about a
/// harness that was installed and working, because the directory holding it
/// was added by `.zshrc` and by nothing a login shell reads.
///
/// **`$SHELL` rather than a name.** The shell belongs to the machine being
/// asked, not to the one asking, and hardcoding `bash` guesses wrong on
/// every machine that has moved on from it. Evaluated over there, so a
/// remote runtime answers about itself.
///
/// **`|| true`** so a script that simply found nothing exits zero. Without
/// it, `command -v` returning 1 — which is how it says "absent" — arrives as
/// a transport failure, and the caller cannot tell a machine with no harness
/// from one it could not reach.
fn ask(r: &dyn Runtime, script: &str) -> Result<String, bancada_runtime::RuntimeError> {
    let inner = quoted(&format!("{script} || true"));
    r.exec(&[
        "sh".into(),
        "-c".into(),
        format!(r#"exec "${{SHELL:-/bin/sh}}" -ilc {inner}"#),
    ])
}

/// One shell argument, quoted so the shell reads it as one.
fn quoted(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
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
    use bancada_testing::{Answers, FakeRuntime};
    use std::collections::BTreeMap;

    const ACCOUNT: &[u8] =
        br#"{"oauthAccount":{"accountUuid":"u1","emailAddress":"a@b.c","organizationName":"Org"}}"#;

    /// A machine with the harness on it, logged in.
    fn installed() -> FakeRuntime {
        FakeRuntime::new(Answers {
            says: vec![
                ("command -v claude".into(), "/usr/bin/claude".into()),
                ("--version".into(), "2.1.221 (Claude Code)".into()),
                ("auth status".into(), "{\"loggedIn\": true}".into()),
            ],
            files: BTreeMap::from([("/c/.claude.json".to_owned(), ACCOUNT.to_vec())]),
            ..Answers::default()
        })
    }

    /// A machine with nothing on it. `command -v` printing nothing is how a
    /// shell says "not here", and it is not an error.
    fn bare() -> FakeRuntime {
        FakeRuntime::new(Answers {
            says: vec![("command -v claude".into(), String::new())],
            ..Answers::default()
        })
    }

    /// A machine that cannot be reached at all — asleep, or gone.
    fn unreachable() -> FakeRuntime {
        FakeRuntime::empty()
    }

    fn spec() -> RuntimeSpec {
        serde_json::from_str(r#"{"id":"r","kind":"vm","configDir":"/c","sharedFs":true}"#).unwrap()
    }

    #[test]
    fn a_runtime_with_the_harness_reports_its_version_and_account() {
        let d = Discovery::probe(&spec(), &installed());
        let h = d.harness.expect("harness");
        assert_eq!(h.path, "/usr/bin/claude");
        assert!(h.logged_in);
        assert_eq!(h.account.unwrap().organization, "Org");
    }

    #[test]
    fn the_lookup_asks_the_target_machine_s_own_shell_interactively() {
        // This shipped as `bash -lc` and reported `bash exited 1` about a
        // harness that was installed and working: the directory holding it
        // reached `PATH` from `.zshrc`, which no login shell reads, and the
        // machine had not used bash as its login shell for years.
        let r = installed();
        Discovery::probe(&spec(), &r);
        let asked = r.commands().join(" | ");
        assert!(!asked.contains("bash"), "a shell was guessed: {asked}");
        assert!(
            asked.contains("${SHELL"),
            "not the target's own shell: {asked}"
        );
        assert!(
            asked.contains("-ilc"),
            "login alone never reads the rc: {asked}"
        );
    }

    #[test]
    fn a_lookup_that_finds_nothing_is_not_allowed_to_fail() {
        // `command -v` says "absent" by exiting 1, and every non-zero exit
        // arrives as an error. Without this the caller cannot tell a machine
        // with no harness from one it could not reach — and the screen has a
        // different sentence for each.
        let r = installed();
        Discovery::probe(&spec(), &r);
        let asked = r.commands();
        assert!(asked.iter().all(|c| c.contains("|| true")), "{asked:?}");
    }

    #[test]
    fn a_runtime_without_the_harness_reports_nothing_rather_than_failing() {
        let d = Discovery::probe(&spec(), &bare());
        assert!(d.harness.is_none());
        assert!(d.error.is_none(), "absent is not an error");
    }

    #[test]
    fn a_runtime_that_cannot_be_reached_says_so_instead_of_looking_empty() {
        let d = Discovery::probe(&spec(), &unreachable());
        assert!(d.harness.is_none());
        assert!(
            d.error.is_some(),
            "unreachable looked like nothing installed"
        );
    }
}
