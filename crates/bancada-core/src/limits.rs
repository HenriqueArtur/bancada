use serde::{Deserialize, Serialize};

/// What kind of work a project is, as a name rather than as numbers.
///
/// A five-hour session is normal in a large refactor and strange almost
/// everywhere else, so every threshold in the rules engine is per project.
/// Asking somebody to pick six numbers before the product says anything
/// useful is asking them to guess, and a guessed threshold is worse than a
/// wrong one because it is never revisited.
///
/// So the numbers have a name in front of them. You say what the work is
/// like; the numbers follow.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Preset {
    /// A session is a task. Quiet for two minutes means it is your turn.
    #[default]
    Normal,
    /// Long stretches with nothing to say are the work, not a symptom.
    LongRefactor,
    /// Short bursts, and you want to be told early.
    Exploratory,
}

impl Preset {
    /// How long a finished turn stays quiet before it is worth your eyes.
    pub const fn idle_after_minutes(self) -> u32 {
        match self {
            Self::Normal => 2,
            Self::LongRefactor => 15,
            Self::Exploratory => 1,
        }
    }
}

/// The numbers a workspace or a project actually states.
///
/// Every field is optional, and that is the point: *not stated here* and
/// *stated to be what the default happens to be* are different facts. The
/// second survives a change to the default; the first is supposed to follow
/// it. Collapsing them is how a settings screen ends up freezing a value
/// nobody chose.
///
/// The weight is not part of a preset. A preset says what the *work* is
/// like; the weight says how much the *project* matters, and a refactor on
/// a project you barely care about is both of those at once.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stated {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset: Option<Preset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub idle_after_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<u32>,
}

impl Stated {
    pub const fn is_empty(&self) -> bool {
        self.preset.is_none() && self.idle_after_minutes.is_none() && self.weight.is_none()
    }
}

/// Where a resolved number came from.
///
/// Carried rather than derived by whoever displays it. The order of
/// precedence is a rule, and a rule written twice — once in Rust and once
/// in the screen that explains it — goes stale in one of the two places.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    /// Stated on the project itself.
    Project,
    /// From the preset the project names.
    ProjectPreset,
    /// Stated on the workspace, and inherited.
    Workspace,
    /// From the preset the workspace names, and inherited.
    WorkspacePreset,
    /// Nobody said anything. [`Preset::Normal`].
    Baseline,
}

/// One number, and where it came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bound {
    pub value: u32,
    pub from: Source,
}

/// Every number the rules engine reads for one project, resolved.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    pub idle_after_minutes: Bound,
    /// How fast waiting hurts here. Scales time; never overrides the kind
    /// of decision, so a permission on a heavy project stays below an
    /// architecture choice on a light one.
    pub weight: Bound,
}

impl Limits {
    pub const fn idle_after_ms(&self) -> i64 {
        self.idle_after_minutes.value as i64 * 60_000
    }

    /// Fold what the project says over what its workspace says.
    ///
    /// Four steps, and the order is the whole rule: a number stated here
    /// beats the preset named here, and anything said here beats anything
    /// said at the workspace. It follows the export level's pattern — the
    /// workspace sets the policy and the project departs from it — because
    /// twelve projects should be three answers, not twelve.
    pub fn resolve(project: &Stated, workspace: &Stated) -> Self {
        Self {
            idle_after_minutes: pick(
                project.idle_after_minutes,
                project.preset.map(Preset::idle_after_minutes),
                workspace.idle_after_minutes,
                workspace.preset.map(Preset::idle_after_minutes),
                Preset::Normal.idle_after_minutes(),
            ),
            // No preset step. The weight is not a property of the kind of
            // work, so a preset has nothing to say about it and pretending
            // otherwise would make "long refactor" quietly change how much
            // a project is worth to you.
            weight: pick(project.weight, None, workspace.weight, None, 1),
        }
    }

    /// The numbers with nobody stating anything.
    pub fn baseline() -> Self {
        Self::resolve(&Stated::default(), &Stated::default())
    }
}

fn pick(
    project: Option<u32>,
    project_preset: Option<u32>,
    workspace: Option<u32>,
    workspace_preset: Option<u32>,
    baseline: u32,
) -> Bound {
    let (value, from) = match (project, project_preset, workspace, workspace_preset) {
        (Some(v), ..) => (v, Source::Project),
        (_, Some(v), ..) => (v, Source::ProjectPreset),
        (_, _, Some(v), _) => (v, Source::Workspace),
        (_, _, _, Some(v)) => (v, Source::WorkspacePreset),
        _ => (baseline, Source::Baseline),
    };
    Bound { value, from }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn preset(p: Preset) -> Stated {
        Stated {
            preset: Some(p),
            ..Stated::default()
        }
    }

    fn idle(n: u32) -> Stated {
        Stated {
            idle_after_minutes: Some(n),
            ..Stated::default()
        }
    }

    #[test]
    fn nobody_stating_anything_is_the_normal_preset() {
        let l = Limits::baseline();
        assert_eq!(
            l.idle_after_minutes.value,
            Preset::Normal.idle_after_minutes()
        );
        assert_eq!(l.idle_after_minutes.from, Source::Baseline);
        assert_eq!((l.weight.value, l.weight.from), (1, Source::Baseline));
    }

    #[test]
    fn a_number_stated_on_the_project_beats_the_preset_beside_it() {
        // The point of keeping both: you pick a preset to avoid configuring
        // six numbers, and then depart from it in the one that is wrong.
        let p = Stated {
            preset: Some(Preset::LongRefactor),
            idle_after_minutes: Some(3),
            ..Stated::default()
        };
        let l = Limits::resolve(&p, &Stated::default());
        assert_eq!(
            (l.idle_after_minutes.value, l.idle_after_minutes.from),
            (3, Source::Project)
        );
    }

    #[test]
    fn a_project_preset_beats_a_number_stated_on_the_workspace() {
        // Nearer wins, whichever form it takes. A project that declares
        // itself a long refactor has said something more specific than the
        // workspace's blanket number.
        let l = Limits::resolve(&preset(Preset::LongRefactor), &idle(4));
        assert_eq!(
            (l.idle_after_minutes.value, l.idle_after_minutes.from),
            (
                Preset::LongRefactor.idle_after_minutes(),
                Source::ProjectPreset
            )
        );
    }

    #[test]
    fn a_project_saying_nothing_inherits_the_workspace() {
        let l = Limits::resolve(&Stated::default(), &idle(9));
        assert_eq!(
            (l.idle_after_minutes.value, l.idle_after_minutes.from),
            (9, Source::Workspace)
        );
    }

    #[test]
    fn a_workspace_preset_reaches_a_project_that_states_nothing() {
        let l = Limits::resolve(&Stated::default(), &preset(Preset::Exploratory));
        assert_eq!(
            (l.idle_after_minutes.value, l.idle_after_minutes.from),
            (
                Preset::Exploratory.idle_after_minutes(),
                Source::WorkspacePreset
            )
        );
    }

    #[test]
    fn a_preset_never_touches_the_weight() {
        // A refactor on a project you barely care about is a long-refactor
        // preset and a weight of 1, and the preset must not raise it.
        let l = Limits::resolve(&preset(Preset::LongRefactor), &preset(Preset::Exploratory));
        assert_eq!((l.weight.value, l.weight.from), (1, Source::Baseline));
    }

    #[test]
    fn the_weight_still_inherits_from_the_workspace() {
        let w = Stated {
            weight: Some(4),
            ..Stated::default()
        };
        assert_eq!(Limits::resolve(&Stated::default(), &w).weight.value, 4);
    }

    #[test]
    fn minutes_become_the_milliseconds_the_rules_engine_asks_for() {
        assert_eq!(
            Limits::resolve(&idle(7), &Stated::default()).idle_after_ms(),
            420_000
        );
    }

    #[test]
    fn nothing_stated_serialises_to_nothing() {
        // A `Stated` that says nothing must not write six nulls into
        // everybody's configuration file the first time it is saved.
        assert_eq!(serde_json::to_string(&Stated::default()).unwrap(), "{}");
        assert!(Stated::default().is_empty());
    }

    #[test]
    fn a_preset_survives_a_round_trip_by_the_name_it_is_written_with() {
        let s = preset(Preset::LongRefactor);
        assert_eq!(
            serde_json::to_string(&s).unwrap(),
            r#"{"preset":"longRefactor"}"#
        );
        let back: Stated = serde_json::from_str(r#"{"preset":"longRefactor"}"#).unwrap();
        assert_eq!(back, s);
    }
}
