//! What the rules engine is allowed to see in one log, in order.
//!
//! The queue is a fold over these, so a queue that looks wrong is almost
//! always a log whose last fact is not the one you assumed. Twice now the
//! answer to "why is nothing waiting?" has been a `ToolCompleted` sitting
//! where an `AgentSpoke` was expected — the agent is working, and the
//! product is right to say nothing.
//!
//! Content never appears here, because [`MetaEvent`] cannot hold any.
//!
//! ```sh
//! cargo run -p bancada-core --example facts -- <log.jsonl> [tail]
//! ```
// The log is read here, at the edge, exactly as the window does it.
#![allow(clippy::disallowed_methods, clippy::disallowed_types)]

use bancada_core::Cockpit;

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("usage: facts <log.jsonl> [tail]");
    let tail: usize = std::env::args()
        .nth(2)
        .and_then(|n| n.parse().ok())
        .unwrap_or(usize::MAX);

    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let facts = Cockpit::facts(&text);

    let shown = facts.len().min(tail);
    if shown < facts.len() {
        println!("{} facts, last {shown}:", facts.len());
    } else {
        println!("{} facts:", facts.len());
    }
    for f in &facts[facts.len() - shown..] {
        println!("  {f:?}");
    }
}
