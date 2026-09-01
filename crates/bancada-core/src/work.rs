use crate::{Cockpit, Config, Project, Workspace};
use bancada_runtime::Runtime;
use serde::Serialize;

/// Everything registered, grouped the way the boundary actually runs.
///
/// The workspace is *the* confidentiality boundary — a project inherits its
/// policy, and two projects in one workspace share a supervisor's reading.
/// Leaving that invisible in the interface makes the most important line in
/// the product a word somebody typed into JSON once.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Work {
    pub workspaces: Vec<Grouped>,
    /// Projects naming a workspace that is not registered.
    ///
    /// Cannot happen through the configuration, which refuses to parse with
    /// one — but a screen that silently drops a project is worse than one
    /// that says it found an orphan.
    pub orphans: Vec<Standing>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Grouped {
    pub workspace: Workspace,
    pub projects: Vec<Standing>,
}

/// One project, and whether it is alive.
///
/// Deliberately no diff and no resource reading. Both cost a process per
/// project per open, and a screen you go to in order to *find* something has
/// to be there before you have finished deciding to look.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Standing {
    pub project: Project,
    /// Sessions the harness has recorded here. Counted from the directory,
    /// never read.
    pub sessions: usize,
    /// When the most recent one was last written, in epoch milliseconds.
    ///
    /// The answer to "is this working?", which today can only be got by
    /// noticing that nothing has appeared in the queue — a signal that looks
    /// identical to a project quietly failing to be read.
    pub last_activity: Option<i64>,
    /// Named rather than silent, exactly as in the queue.
    pub unreachable: Option<String>,
}

impl Cockpit {
    /// Everything registered, with just enough state to be worth opening.
    pub fn work(&self, host: &dyn Runtime) -> Work {
        let mut orphans = Vec::new();
        let mut workspaces: Vec<Grouped> = self
            .config()
            .workspaces
            .iter()
            .map(|w| Grouped {
                workspace: w.clone(),
                projects: Vec::new(),
            })
            .collect();

        for project in &self.config().projects {
            let standing = self.standing(project, host);
            match workspaces
                .iter_mut()
                .find(|g| g.workspace.id == project.workspace)
            {
                Some(g) => g.projects.push(standing),
                None => orphans.push(standing),
            }
        }

        for g in &mut workspaces {
            g.projects.sort_by(|a, b| a.project.id.cmp(&b.project.id));
        }
        workspaces.sort_by(|a, b| a.workspace.id.cmp(&b.workspace.id));

        Work {
            workspaces,
            orphans,
        }
    }

    fn standing(&self, project: &Project, host: &dyn Runtime) -> Standing {
        let scan = self.scan(project, host);
        let last_activity = scan.logs.iter().filter_map(|p| host.modified(p)).max();
        Standing {
            project: project.clone(),
            sessions: scan.logs.len(),
            last_activity,
            unreachable: scan.unreachable,
        }
    }
}

impl Config {
    /// Register a workspace, or replace the one with the same id.
    pub fn with_workspace(mut self, workspace: Workspace) -> Self {
        self.workspaces.retain(|w| w.id != workspace.id);
        self.workspaces.push(workspace);
        self.workspaces.sort_by(|a, b| a.id.cmp(&b.id));
        self
    }

    /// Rename a workspace, taking everything that belongs to it along.
    ///
    /// A rename that left the projects pointing at the old name would not
    /// produce an error — it would produce a configuration that refuses to
    /// parse, which is a cockpit that will not open. The projects move.
    pub fn rename_workspace(mut self, from: &str, to: &str) -> Result<Self, String> {
        if from == to {
            return Ok(self);
        }
        if !self.workspaces.iter().any(|w| w.id == from) {
            return Err(format!("no workspace called {from}"));
        }
        if self.workspaces.iter().any(|w| w.id == to) {
            return Err(format!("{to} already exists"));
        }
        for w in &mut self.workspaces {
            if w.id == from {
                w.id = to.to_owned();
            }
        }
        for p in &mut self.projects {
            if p.workspace == from {
                p.workspace = to.to_owned();
            }
        }
        self.workspaces.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(self)
    }

    /// Rename a project.
    ///
    /// Nothing points at a project by name, so this only has to not leave
    /// the old one behind — which is exactly what registering under a new
    /// name would do.
    pub fn rename_project(mut self, from: &str, to: &str) -> Result<Self, String> {
        if from == to {
            return Ok(self);
        }
        if self.projects.iter().any(|p| p.id == to) {
            return Err(format!("{to} already exists"));
        }
        self.projects.retain(|p| p.id != from);
        Ok(self)
    }

    /// Drop a workspace, unless something still belongs to it.
    ///
    /// Refused rather than cascaded: forgetting a workspace and silently
    /// forgetting the client work inside it is not a thing a person meant.
    pub fn without_workspace(mut self, id: &str) -> Result<Self, String> {
        let held: Vec<&str> = self
            .projects
            .iter()
            .filter(|p| p.workspace == id)
            .map(|p| p.id.as_str())
            .collect();
        if !held.is_empty() {
            return Err(format!(
                "{id} still holds {} — forget {} first",
                held.join(", "),
                if held.len() == 1 { "it" } else { "them" }
            ));
        }
        self.workspaces.retain(|w| w.id != id);
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Export;
    use bancada_runtime::{FsAccess, PathMap, RuntimeError};
    use std::path::{Path, PathBuf};

    const CFG: &str = r#"{
      "workspaces": [{"id":"personal"},{"id":"client-x","export":"summary"}],
      "runtimes": [{"id":"local","kind":"local","configDir":"/state/claude","sharedFs":true}],
      "projects": [
        {"id":"zed","workspace":"personal","path":"/dev/zed","runtime":"local"},
        {"id":"api","workspace":"client-x","path":"/dev/api","runtime":"local"},
        {"id":"app","workspace":"personal","path":"/dev/app","runtime":"local"}
      ]
    }"#;

    /// Answers with two logs for `zed` and nothing for anybody else.
    struct Fake;
    impl Runtime for Fake {
        fn id(&self) -> &str {
            "fake"
        }
        fn kind(&self) -> &str {
            "local"
        }
        fn paths(&self) -> &PathMap {
            unimplemented!()
        }
        fn fs_access(&self) -> FsAccess {
            FsAccess::Shared
        }
        fn exec(&self, _: &[String]) -> Result<String, RuntimeError> {
            unimplemented!()
        }
        fn read_file(&self, p: &Path) -> Result<Vec<u8>, RuntimeError> {
            Err(RuntimeError::NotFound(p.display().to_string()))
        }
        fn modified(&self, p: &Path) -> Option<i64> {
            p.to_string_lossy().contains("dev-zed").then_some(1_700)
        }
        fn read_dir(&self, p: &Path) -> Result<Vec<PathBuf>, RuntimeError> {
            if p.to_string_lossy().contains("-dev-zed") {
                Ok(vec![p.join("a.jsonl"), p.join("b.jsonl")])
            } else {
                Err(RuntimeError::NotFound(p.display().to_string()))
            }
        }
    }

    fn work() -> Work {
        Cockpit::new(Config::parse(CFG).unwrap()).work(&Fake)
    }

    #[test]
    fn projects_sit_under_the_workspace_that_owns_them() {
        let w = work();
        let by = |id: &str| {
            w.workspaces
                .iter()
                .find(|g| g.workspace.id == id)
                .map(|g| {
                    g.projects
                        .iter()
                        .map(|s| s.project.id.as_str())
                        .collect::<Vec<_>>()
                })
                .unwrap()
        };
        assert_eq!(by("personal"), ["app", "zed"]);
        assert_eq!(by("client-x"), ["api"]);
    }

    #[test]
    fn a_workspace_carries_the_policy_its_projects_inherit() {
        // The boundary is the workspace, so the export level belongs beside
        // its name rather than repeated on every project under it.
        let w = work();
        let x = w
            .workspaces
            .iter()
            .find(|g| g.workspace.id == "client-x")
            .unwrap();
        assert_eq!(x.workspace.export, Export::Summary);
    }

    #[test]
    fn an_empty_workspace_is_still_listed() {
        // Otherwise registering one and then looking for it finds nothing,
        // and the only way to tell it exists is to open the JSON.
        let cfg = r#"{"workspaces":[{"id":"empty"}]}"#;
        let w = Cockpit::new(Config::parse(cfg).unwrap()).work(&Fake);
        assert_eq!(w.workspaces.len(), 1);
        assert!(w.workspaces[0].projects.is_empty());
    }

    #[test]
    fn a_project_says_how_alive_it_is() {
        let w = work();
        let zed = w.workspaces[1]
            .projects
            .iter()
            .find(|s| s.project.id == "zed")
            .unwrap();
        assert_eq!(zed.sessions, 2);
        assert_eq!(zed.last_activity, Some(1_700));
    }

    #[test]
    fn a_project_with_no_directory_yet_is_quiet_rather_than_broken() {
        let w = work();
        let api = w.workspaces[0]
            .projects
            .iter()
            .find(|s| s.project.id == "api")
            .unwrap();
        assert_eq!(api.sessions, 0);
        assert_eq!(api.last_activity, None);
        assert_eq!(api.unreachable, None);
    }

    #[test]
    fn forgetting_a_workspace_that_still_holds_work_is_refused() {
        // Cascading would forget the client work inside it, which is not a
        // thing anybody meant by "remove this label".
        let err = Config::parse(CFG)
            .unwrap()
            .without_workspace("personal")
            .unwrap_err();
        assert!(err.contains("app") && err.contains("zed"), "{err}");
    }

    #[test]
    fn an_empty_workspace_can_be_forgotten() {
        let cfg = Config::parse(CFG).unwrap().with_workspace(Workspace {
            id: "spare".into(),
            export: Export::Metadata,
        });
        assert!(cfg.without_workspace("spare").is_ok());
    }

    #[test]
    fn renaming_a_workspace_takes_its_projects_with_it() {
        // Left behind, they would point at a name that no longer exists —
        // and that configuration does not fail to save, it fails to *open*.
        let cfg = Config::parse(CFG)
            .unwrap()
            .rename_workspace("personal", "mine")
            .unwrap();
        assert!(cfg.workspaces.iter().any(|w| w.id == "mine"));
        assert!(
            cfg.projects
                .iter()
                .filter(|p| p.workspace == "mine")
                .count()
                == 2
        );
        assert!(!cfg.projects.iter().any(|p| p.workspace == "personal"));
        // And what it produced still parses, which is the actual claim.
        let text = serde_json::to_string(&cfg).unwrap();
        assert!(Config::parse(&text).is_ok());
    }

    #[test]
    fn renaming_onto_a_name_that_exists_is_refused() {
        let err = Config::parse(CFG)
            .unwrap()
            .rename_workspace("personal", "client-x")
            .unwrap_err();
        assert!(err.contains("already exists"), "{err}");
    }

    #[test]
    fn renaming_a_workspace_to_itself_changes_nothing() {
        let before = Config::parse(CFG).unwrap();
        let after = before
            .clone()
            .rename_workspace("personal", "personal")
            .unwrap();
        assert_eq!(before, after);
    }

    #[test]
    fn renaming_a_project_leaves_nothing_behind() {
        // Registering under a new name would keep the old entry, and the
        // cockpit would watch the same tree twice under two names.
        let cfg = Config::parse(CFG)
            .unwrap()
            .rename_project("zed", "editor")
            .unwrap();
        assert!(!cfg.projects.iter().any(|p| p.id == "zed"));
        assert_eq!(cfg.projects.len(), 2);
    }

    #[test]
    fn registering_a_workspace_twice_replaces_rather_than_duplicates() {
        let cfg = Config::parse(CFG).unwrap().with_workspace(Workspace {
            id: "personal".into(),
            export: Export::Full,
        });
        assert_eq!(cfg.workspaces.len(), 2);
        assert_eq!(cfg.workspaces[1].export, Export::Full);
    }
}
