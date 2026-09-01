// Same boundary as `queue`: the filesystem is read here, at the edge.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::Cockpit;
use bancada_runtime::{HostRuntime, Runtime};
use serde::Serialize;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    /// Relative to the project root, in the project's own spelling.
    pub path: String,
    pub name: String,
    pub is_dir: bool,
}

/// List one directory inside a project, one level deep.
///
/// One level rather than the whole tree: a repository with a `node_modules`
/// in it will happily hand back a hundred thousand entries, and a cockpit
/// that stalls for thirty seconds on open has stopped being a cockpit.
#[tauri::command]
pub fn tree(project: String, sub: Option<String>) -> Result<Vec<Entry>, String> {
    let (root, host) = project_root(&project)?;
    let sub = sub.unwrap_or_default();
    let dir = under(&root, &sub)?;

    let mut out: Vec<Entry> = host
        .read_dir(&dir)
        .map_err(|e| format!("{e:?}"))?
        .into_iter()
        .filter_map(|p| {
            let name = p.file_name()?.to_string_lossy().into_owned();
            if name == ".git" {
                return None;
            }
            let rel = if sub.is_empty() {
                name.clone()
            } else {
                format!("{sub}/{name}")
            };
            Some(Entry {
                is_dir: host.read_dir(&p).is_ok(),
                path: rel,
                name,
            })
        })
        .collect();

    // Directories first, then names: the order a person expects, and stable
    // between two calls so the pane does not shuffle under the cursor.
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(out)
}

/// The text of one file inside a project.
#[tauri::command]
pub fn file(project: String, path: String) -> Result<String, String> {
    const MAX: usize = 1024 * 1024;
    let (root, host) = project_root(&project)?;
    let target = under(&root, &path)?;

    let bytes = host.read_file(&target).map_err(|e| format!("{e:?}"))?;
    if bytes.len() > MAX {
        return Err(format!("{} bytes is too large to show", bytes.len()));
    }
    if bytes.contains(&0) {
        return Err("binary file".to_owned());
    }
    String::from_utf8(bytes).map_err(|_| "not text".to_owned())
}

/// The project's tree, and a runtime that can reach it.
///
/// The project's own runtime, not the local one: `path` is written in the
/// *guest's* spelling, and only that runtime knows how the host spells the
/// same tree. Reading it locally would look for `/mnt/dev/...` on a Mac and
/// report the project missing.
fn project_root(id: &str) -> Result<(PathBuf, HostRuntime), String> {
    let cockpit = Cockpit::new(super::queue::load_config()?);
    let project = cockpit
        .config()
        .projects
        .iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("no project registered as {id}"))?;
    let at = cockpit
        .config()
        .runtime_of(project)
        .ok_or_else(|| format!("no runtime registered for {id}"))?
        .open();
    Ok((PathBuf::from(&project.path), at))
}

/// Join a caller-supplied relative path to the project root, refusing to
/// leave it.
///
/// The webview is the only caller today, but it is still the untrusted side
/// of the seam: a plugin that could ask for `../../.ssh/id_rsa` through this
/// command would turn a read-only file pane into a credential reader.
fn under(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = Path::new(rel);
    if rel.is_absolute() || rel.components().any(|c| c == Component::ParentDir) {
        return Err(format!("{} is outside the project", rel.display()));
    }
    Ok(root.join(rel))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_path_inside_the_project_is_joined() {
        assert_eq!(
            under(Path::new("/repo"), "src/db.rs").unwrap(),
            Path::new("/repo/src/db.rs")
        );
    }

    #[test]
    fn climbing_out_of_the_project_is_refused() {
        assert!(under(Path::new("/repo"), "../../.ssh/id_rsa").is_err());
    }

    #[test]
    fn an_absolute_path_is_refused_rather_than_silently_rerooted() {
        // `Path::join` with an absolute argument *replaces* the root, so
        // without this check the guard would read exactly what it forbids.
        assert!(under(Path::new("/repo"), "/etc/passwd").is_err());
    }

    #[test]
    fn an_empty_path_is_the_project_root() {
        assert_eq!(under(Path::new("/repo"), "").unwrap(), Path::new("/repo"));
    }
}
