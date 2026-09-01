/// Pieces that are always several components at once.
///
/// A composite knows how its parts fit together and still knows nothing
/// about the product: `Field` does not know what a project is, `Notice` does
/// not know what a session is. Whatever needs to know that belongs in a
/// page.
export { Field, ChoiceField } from "@/composites/field";
export { Notice, type Tone } from "@/composites/notice";
export { Section } from "@/composites/section";
export { EmptyState } from "@/composites/empty-state";
export { Banner } from "@/composites/banner";
export { NewThing } from "@/composites/new-thing";
