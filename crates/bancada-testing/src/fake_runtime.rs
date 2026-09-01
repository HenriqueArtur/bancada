use bancada_runtime::{FsAccess, PathMap, Runtime, RuntimeError};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// What a fake runtime should say when asked.
///
/// Every field defaults to *nothing here*, which is the answer a runtime
/// gives about a machine with nothing on it — so a test states only the part
/// it is about.
#[derive(Debug, Default)]
pub struct Answers {
    /// Directory → what listing it returns. A path not named is `NotFound`,
    /// which is what an empty harness state directory looks like.
    pub dirs: BTreeMap<String, Vec<PathBuf>>,
    /// File → its bytes.
    pub files: BTreeMap<String, Vec<u8>>,
    /// A substring of the command → what it prints. First match wins, so a
    /// test can answer `git diff` without describing every other call.
    pub says: Vec<(String, String)>,
    /// Path substring → its modification time.
    pub times: Vec<(String, i64)>,
    /// Paths that answer `Failed` rather than `NotFound`.
    ///
    /// The two are a different thing to say — a directory that is not there
    /// yet is a project with no sessions, and a directory that refused is a
    /// machine asleep. Code that treats them alike needs a way to be caught.
    pub refuse: Vec<String>,
    pub access: Option<FsAccess>,
}

/// A runtime that answers from a script and remembers what it was asked.
///
/// The recording is the point as often as the answers are: *which path did
/// `git -C` get* is the assertion, not what git said back.
pub struct FakeRuntime {
    answers: Answers,
    paths: PathMap,
    asked: Mutex<Vec<String>>,
}

impl FakeRuntime {
    pub fn new(answers: Answers) -> Self {
        Self {
            answers,
            paths: PathMap::new("/", "/"),
            asked: Mutex::new(Vec::new()),
        }
    }

    /// A runtime that knows nothing, for the tests that only need one to exist.
    pub fn empty() -> Self {
        Self::new(Answers::default())
    }

    pub fn mapping(mut self, host_root: &str, guest_root: &str) -> Self {
        self.paths = PathMap::new(host_root, guest_root);
        self
    }

    /// Every command it was given, in order, joined by spaces.
    pub fn commands(&self) -> Vec<String> {
        self.asked
            .lock()
            .expect("no test panicked holding this")
            .clone()
    }
}

impl Runtime for FakeRuntime {
    fn id(&self) -> &str {
        "fake"
    }

    fn kind(&self) -> &str {
        "fake"
    }

    fn paths(&self) -> &PathMap {
        &self.paths
    }

    fn fs_access(&self) -> FsAccess {
        self.answers.access.unwrap_or(FsAccess::Shared)
    }

    fn exec(&self, cmd: &[String]) -> Result<String, RuntimeError> {
        let line = cmd.join(" ");
        self.asked
            .lock()
            .expect("no test panicked holding this")
            .push(line.clone());
        match self
            .answers
            .says
            .iter()
            .find(|(needle, _)| line.contains(needle.as_str()))
        {
            Some((_, said)) => Ok(said.clone()),
            // Refused rather than empty: a command nobody scripted is a test
            // reaching further than it meant to, and silence would let it.
            None => Err(RuntimeError::Failed(format!("unscripted: {line}"))),
        }
    }

    fn modified(&self, guest_path: &Path) -> Option<i64> {
        let p = guest_path.display().to_string();
        self.answers
            .times
            .iter()
            .find(|(needle, _)| p.contains(needle.as_str()))
            .map(|(_, at)| *at)
    }

    fn read_file(&self, guest_path: &Path) -> Result<Vec<u8>, RuntimeError> {
        let p = guest_path.display().to_string();
        self.answers
            .files
            .get(&p)
            .cloned()
            .ok_or(RuntimeError::NotFound(p))
    }

    fn read_dir(&self, guest_path: &Path) -> Result<Vec<PathBuf>, RuntimeError> {
        let p = guest_path.display().to_string();
        if self
            .answers
            .refuse
            .iter()
            .any(|needle| p.contains(needle.as_str()))
        {
            return Err(RuntimeError::Failed(format!("refused: {p}")));
        }
        self.answers
            .dirs
            .get(&p)
            .cloned()
            .ok_or(RuntimeError::NotFound(p))
    }
}
