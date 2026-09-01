use crate::{Project, RuntimeSpec, Workspace};
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
        cfg.check()?;
        Ok(cfg)
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
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
