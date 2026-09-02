/// The frame: how things sit, never what they are.
///
/// Layouts and pages compose from here and from `components`, and reach for
/// no raw HTML at all — a rule archwarden enforces. Consistency in spacing
/// is the kind that erodes silently otherwise: one `mt-6` at a time, none of
/// them wrong on their own.
export { Stack, Row, Push, Fill, type Gap } from "@/frame/stack";
export { Bleed } from "@/frame/bleed";
export { Grid, Full } from "@/frame/grid";
export { Inset, Divider, Scroller } from "@/frame/inset";
export { Measure, Page } from "@/frame/page";
export { Mount } from "@/frame/mount";
export { Listing, ListingItem, Region } from "@/frame/listing";
