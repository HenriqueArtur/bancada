use crate::Stated;
use serde::{Deserialize, Serialize};

/// A confidentiality group. The boundary.
///
/// Policy lives here and a project inherits it, so twelve projects are
/// three policies. The question when registering a project becomes
/// *"whose is this?"* — which is trivial and never answered wrong.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    /// What the *other* workspaces' supervisors may read from this one.
    /// Export permission, not import.
    #[serde(default)]
    pub export: Export,
    /// The numbers every project here starts from.
    ///
    /// The same shape as the export level and for the same reason: policy
    /// is stated once and departed from where it is wrong, so twelve
    /// projects are three answers rather than twelve.
    #[serde(default, skip_serializing_if = "Stated::is_empty")]
    pub limits: Stated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Export {
    /// A new workspace is born here. It rises by a deliberate act, never
    /// by default and never the other way.
    #[default]
    Metadata,
    Summary,
    Full,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_workspace_with_no_export_stated_is_closed() {
        let w: Workspace = serde_json::from_str(r#"{"id":"sunne"}"#).unwrap();
        assert_eq!(w.export, Export::Metadata);
    }

    #[test]
    fn an_export_level_survives_a_round_trip() {
        let w = Workspace {
            id: "personal".into(),
            export: Export::Full,
            limits: Stated::default(),
        };
        let back: Workspace = serde_json::from_str(&serde_json::to_string(&w).unwrap()).unwrap();
        assert_eq!(w, back);
    }
}
