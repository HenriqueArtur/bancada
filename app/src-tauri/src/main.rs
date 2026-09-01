// The window's entry point, and nothing else.
//
// Everything it can do lives in the library beside it, so the commands can
// be driven from a test — a binary has nothing to link a test against, and
// the seam is exactly the part worth exercising against a real tree.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    bancada_app::run();
}
