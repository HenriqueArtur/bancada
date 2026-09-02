/// One folder per screen: its data, its parts, and its rendering.
///
/// A page is the only layer allowed to know both what the product means and
/// how it looks. Everything under it is reusable; a page never is.
export { CockpitView } from "@/pages/cockpit/view";
export { useCockpit } from "@/pages/cockpit/logic";
export { ChangesPage } from "@/pages/review/view";
export { SessionsPage } from "@/pages/sessions/view";
export { GitPage } from "@/pages/git/view";
export { FilesPage } from "@/pages/files/view";
export { SettingsPage } from "@/pages/settings/view";
export { WorkPage } from "@/pages/work/view";
