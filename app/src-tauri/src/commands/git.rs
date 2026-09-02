// Same boundary as `queue`: the filesystem is read here, at the edge.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::{Branch, Cockpit, Commit, Diff, FIELDS, Repo, tracking};
use bancada_runtime::Runtime;
use serde::Serialize;

/// Run `git` inside a project's tree, through the runtime the project runs
/// on.
///
/// The project's runtime and never `HostRuntime::local()`. This is the bug
/// we already shipped once: a project living in a VM had `git -C
/// /mnt/dev/...` run on the Mac, which reported the tree missing rather than
/// the truth.
fn git(project: &str, args: &[&str]) -> Result<String, String> {
    let cockpit = Cockpit::new(super::queue::load_config()?);
    let p = cockpit
        .config()
        .projects
        .iter()
        .find(|p| p.id == project)
        .ok_or_else(|| format!("no project registered as {project}"))?;
    let at = cockpit
        .config()
        .runtime_of(p)
        .ok_or_else(|| format!("no runtime registered for {}", p.id))?
        .open();

    let mut cmd = vec!["git".to_owned(), "-C".to_owned(), p.path.clone()];
    cmd.extend(args.iter().map(|a| (*a).to_owned()));
    at.exec(&cmd).map_err(|e| format!("{e:?}"))
}

/// Whether this project is a repository at all, and where it stands.
///
/// Cheap on purpose: it is asked every time a project is opened, only to
/// decide whether the history tab is offered. A directory that git has never
/// been told about is a normal thing for a project to point at, and it
/// answers `is_git: false` rather than failing.
#[tauri::command]
pub fn repo(project: String) -> Result<Repo, String> {
    let Ok(head) = git(&project, &["rev-parse", "--abbrev-ref", "HEAD"]) else {
        return Ok(Repo::default());
    };
    let head = head.trim();
    let (ahead, behind) = git(
        &project,
        &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    )
    .map(|t| tracking(&t))
    // No upstream is the common state of a branch nobody has pushed yet,
    // and level is the honest reading of it.
    .unwrap_or((0, 0));

    Ok(Repo {
        is_git: true,
        // `HEAD` is what `--abbrev-ref` prints when nothing is checked out
        // by name. Reported as no branch rather than as a branch called
        // HEAD, which is a branch that does not exist.
        head: (head != "HEAD" && !head.is_empty()).then(|| head.to_owned()),
        ahead,
        behind,
    })
}

/// A page of the history, newest first.
///
/// Paged rather than whole: a repository is tens of thousands of commits and
/// the reader wants the last few. `skip` is how many are already on screen.
#[tauri::command]
pub fn history(project: String, skip: usize, take: usize) -> Result<Vec<Commit>, String> {
    // One more than asked for, so the caller can tell "that is all of them"
    // from "there is another page" without a second count over the whole
    // history. The extra is dropped on the way out.
    let over = take + 1;
    let text = git(
        &project,
        &[
            "log",
            &format!("--max-count={over}"),
            &format!("--skip={skip}"),
            "--no-color",
            &format!("--format={FIELDS}"),
        ],
    )?;
    Ok(Commit::parse(&text))
}

#[tauri::command]
pub fn branches(project: String) -> Result<Vec<Branch>, String> {
    let text = git(
        &project,
        &[
            "branch",
            "--no-color",
            "--format=%(HEAD)%09%(refname:short)%09%(objectname:short)",
        ],
    )?;
    Ok(Branch::parse(&text))
}

/// One commit, and everything it changed.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Landed {
    pub commit: Commit,
    /// The message below the subject line, whole.
    ///
    /// Not folded into `Commit`, because the list does not want it: a page
    /// of thirty commits would carry thirty essays across the seam to render
    /// thirty single lines. This repository writes long ones on purpose —
    /// the diff already says what changed, and the body is the only place
    /// what was considered and dropped is written down.
    pub body: String,
    pub diff: Diff,
}

#[tauri::command]
pub fn commit(project: String, sha: String) -> Result<Landed, String> {
    // Refused rather than passed through. `sha` arrives from the webview,
    // and a value beginning with `-` is read by git as an option — which is
    // how a file list becomes an argument to `--output`.
    if sha.is_empty() || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!("{sha} is not a commit"));
    }

    let meta = git(
        &project,
        &[
            "show",
            "-s",
            "--no-color",
            &format!("--format={FIELDS}"),
            &sha,
        ],
    )?;
    let commit = Commit::parse(&meta)
        .into_iter()
        .next()
        .ok_or_else(|| format!("no commit {sha}"))?;

    // `%b` holds newlines and tabs, so it cannot share a line with the
    // tab-separated fields above. Its own call, rather than a second format
    // whose parsing would have to guess where the last field ends.
    let body = git(&project, &["show", "-s", "--no-color", "--format=%b", &sha])?;

    let text = git(
        &project,
        &["show", "--no-color", "--no-ext-diff", "--format=", &sha],
    )?;
    Ok(Landed {
        commit,
        body: body.trim().to_owned(),
        diff: Diff::parse(&text),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sha_that_could_be_an_option_is_refused() {
        // `git show --output=/etc/passwd` is a write, reached through a
        // field the webview fills. The check is here rather than in the
        // webview because the webview is the untrusted side of the seam.
        assert!(commit("p".into(), "--output=/tmp/x".into()).is_err());
    }

    #[test]
    fn a_sha_that_is_not_hex_is_refused() {
        assert!(commit("p".into(), "HEAD~1".into()).is_err());
        assert!(commit("p".into(), String::new()).is_err());
    }
}
