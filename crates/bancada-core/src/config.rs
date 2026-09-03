use crate::{Limits, Project, RuntimeSpec, Stated, Workspace};
use serde::{Deserialize, Serialize};

/// Everything the product was told, and nothing it guessed.
///
/// Discovery proposes; this is what you registered. The two are kept apart
/// on purpose: forty containers would hide the three that matter, so
/// nothing reaches the queue because it merely exists.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub workspaces: Vec<Workspace>,
    #[serde(default)]
    pub runtimes: Vec<RuntimeSpec>,
    #[serde(default)]
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigError {
    Unreadable(String),
    Malformed(String),
    /// A project naming a runtime or workspace that was never registered.
    /// Named rather than skipped: a project silently missing from the
    /// queue looks exactly like a project with nothing pending.
    Dangling(String),
}

impl Config {
    pub fn parse(text: &str) -> Result<Self, ConfigError> {
        let cfg: Self =
            serde_json::from_str(text).map_err(|e| ConfigError::Malformed(e.to_string()))?;
        let cfg = cfg.migrated();
        cfg.check()?;
        Ok(cfg)
    }

    /// Parse, with the machine bancada is running on already present.
    ///
    /// The default is added **before** the check, not after: a project may
    /// name `this-machine` in a file that never mentions it, and validating
    /// first would reject a configuration that is complete.
    pub fn parse_with_home(text: &str, home: &std::path::Path) -> Result<Self, ConfigError> {
        let cfg: Self =
            serde_json::from_str(text).map_err(|e| ConfigError::Malformed(e.to_string()))?;
        let cfg = cfg.migrated().with_this_machine(home);
        cfg.check()?;
        Ok(cfg)
    }

    /// Fold every project's pre-preset numbers into its `limits`.
    ///
    /// On the way in, once, rather than at each read: a rule applied where
    /// it is needed is a rule some future reader will forget in the one
    /// place that matters, and the whole product asks for these numbers.
    #[must_use]
    fn migrated(mut self) -> Self {
        self.projects = self.projects.into_iter().map(Project::migrated).collect();
        self
    }

    /// Every number the rules engine reads for one project.
    ///
    /// Here rather than on `Project` because resolving needs the workspace,
    /// and a project does not know its own — it knows the *name* of one,
    /// which only the configuration can turn into policy.
    pub fn limits_of(&self, project: &Project) -> Limits {
        let workspace = self
            .workspaces
            .iter()
            .find(|w| w.id == project.workspace)
            .map_or_else(Stated::default, |w| w.limits);
        Limits::resolve(&project.limits, &workspace)
    }

    fn check(&self) -> Result<(), ConfigError> {
        for p in &self.projects {
            if !self.runtimes.iter().any(|r| r.id == p.runtime) {
                return Err(ConfigError::Dangling(format!(
                    "project `{}` names runtime `{}`, which is not registered",
                    p.id, p.runtime
                )));
            }
            if !self.workspaces.iter().any(|w| w.id == p.workspace) {
                return Err(ConfigError::Dangling(format!(
                    "project `{}` names workspace `{}`, which is not registered",
                    p.id, p.workspace
                )));
            }
        }
        Ok(())
    }

    pub fn runtime_of(&self, project: &Project) -> Option<&RuntimeSpec> {
        self.runtimes.iter().find(|r| r.id == project.runtime)
    }

    /// Add the machine bancada is running on, unless it was written down.
    ///
    /// Called after reading, never before writing. An explicit entry with
    /// the reserved id wins: somebody whose harness keeps its state
    /// somewhere unusual must be able to say so, and a default that cannot
    /// be overridden is a default that eventually lies.
    #[must_use]
    pub fn with_this_machine(mut self, home: &std::path::Path) -> Self {
        if !self
            .runtimes
            .iter()
            .any(|r| r.id == RuntimeSpec::THIS_MACHINE)
        {
            self.runtimes.push(RuntimeSpec::this_machine(home));
            self.runtimes.sort_by(|a, b| a.id.cmp(&b.id));
        }
        self
    }

    /// Drop the machine bancada is running on, if it is still the default.
    ///
    /// The counterpart of [`Config::with_this_machine`], and the reason
    /// writing is safe: persisting the synthesised entry would freeze
    /// today's `$HOME` into a file that outlives it, and the copy on disk
    /// would quietly win over the fact.
    #[must_use]
    pub fn without_this_machine(mut self, home: &std::path::Path) -> Self {
        let default = RuntimeSpec::this_machine(home);
        self.runtimes.retain(|r| r != &default);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    const GOOD: &str = r#"{
      "workspaces": [{"id":"personal"}],
      "runtimes": [{"id":"local","kind":"local","configDir":"/c","sharedFs":true}],
      "projects": [{"id":"p","workspace":"personal","runtime":"local","path":"/x"}]
    }"#;

    #[test]
    fn a_whole_configuration_round_trips() {
        let c = Config::parse(GOOD).unwrap();
        assert_eq!(c.projects.len(), 1);
        assert_eq!(c.runtime_of(&c.projects[0]).unwrap().id, "local");
    }

    #[test]
    fn an_empty_configuration_is_valid_and_empty() {
        assert_eq!(Config::parse("{}").unwrap(), Config::default());
    }

    #[test]
    fn a_project_naming_an_unregistered_runtime_is_refused_not_skipped() {
        let bad = GOOD.replace(r#""runtime":"local""#, r#""runtime":"ghost""#);
        assert!(
            matches!(Config::parse(&bad), Err(ConfigError::Dangling(m)) if m.contains("ghost"))
        );
    }

    #[test]
    fn a_project_naming_an_unregistered_workspace_is_refused_too() {
        let bad = GOOD.replace(
            r#""workspace":"personal","runtime""#,
            r#""workspace":"ghost","runtime""#,
        );
        assert!(matches!(Config::parse(&bad), Err(ConfigError::Dangling(_))));
    }

    #[test]
    fn malformed_json_is_named_rather_than_defaulted() {
        assert!(matches!(Config::parse("{"), Err(ConfigError::Malformed(_))));
    }

    #[test]
    fn the_machine_it_runs_on_is_there_without_being_written_down() {
        let c = Config::parse("{}")
            .unwrap()
            .with_this_machine(Path::new("/Users/h"));
        let this = c
            .runtimes
            .iter()
            .find(|r| r.id == RuntimeSpec::THIS_MACHINE)
            .expect("the machine bancada runs on");
        assert_eq!(this.config_dir, "/Users/h/.claude");
        assert!(this.prefix.is_empty(), "there is nothing to run through");
    }

    #[test]
    fn an_explicit_entry_wins_over_the_default() {
        // Somebody whose harness keeps its state somewhere unusual must be
        // able to say so. A default that cannot be overridden is one that
        // eventually lies.
        let text = r#"{"runtimes":[{"id":"this-machine","kind":"local",
                       "configDir":"/opt/claude","sharedFs":true}]}"#;
        let c = Config::parse(text)
            .unwrap()
            .with_this_machine(Path::new("/Users/h"));
        assert_eq!(c.runtimes.len(), 1);
        assert_eq!(c.runtimes[0].config_dir, "/opt/claude");
    }

    #[test]
    fn adding_it_twice_does_not_produce_two() {
        let home = Path::new("/Users/h");
        let c = Config::parse("{}")
            .unwrap()
            .with_this_machine(home)
            .with_this_machine(home);
        assert_eq!(c.runtimes.len(), 1);
    }

    #[test]
    fn the_default_is_dropped_again_before_writing() {
        // Persisting it would freeze today's `$HOME` into a file that
        // outlives it, and the copy on disk would quietly win over the fact.
        let home = Path::new("/Users/h");
        let c = Config::parse("{}").unwrap().with_this_machine(home);
        assert!(c.without_this_machine(home).runtimes.is_empty());
    }

    #[test]
    fn an_edited_entry_survives_the_write() {
        let home = Path::new("/Users/h");
        let mut c = Config::parse("{}").unwrap().with_this_machine(home);
        c.runtimes[0].config_dir = "/opt/claude".into();
        assert_eq!(
            c.without_this_machine(home).runtimes.len(),
            1,
            "a runtime somebody changed is no longer the default"
        );
    }

    #[test]
    fn a_project_may_name_it_without_the_file_mentioning_it() {
        let text = r#"{"workspaces":[{"id":"personal"}],
                       "projects":[{"id":"p","workspace":"personal",
                                    "runtime":"this-machine","path":"/x"}]}"#;
        // Parsed alone this is dangling; the default is what makes it whole,
        // so the injection has to happen before the check that rejects it.
        assert!(matches!(Config::parse(text), Err(ConfigError::Dangling(_))));
        let c = Config::parse_with_home(text, Path::new("/Users/h")).unwrap();
        assert_eq!(c.runtime_of(&c.projects[0]).unwrap().id, "this-machine");
    }
}
