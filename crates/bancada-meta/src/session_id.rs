use serde::{Deserialize, Serialize};
/// Opaque identity of a session, as the harness spelled it.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct SessionId(String);

impl SessionId {
    pub fn new(raw: impl Into<String>) -> Self {
        Self(raw.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_the_spelling_it_was_given() {
        let id = SessionId::new("2368a3d6-5c6b-4d02-b82e-e062070bbc6d");
        assert_eq!(id.as_str(), "2368a3d6-5c6b-4d02-b82e-e062070bbc6d");
    }
}
