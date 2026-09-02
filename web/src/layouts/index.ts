/// Where things go on a screen. No content of their own.
///
/// A layout takes children and arranges them; it never knows what they are.
/// That is what lets the cockpit and the review share one shell without the
/// shell learning about either.
export { AppShell } from "@/layouts/app-shell";
export { SettingsDialog, type SettingsSection } from "@/layouts/settings-dialog";
export { Panes, ProjectShell } from "@/layouts/project-shell";
