/// The alphabet: one idea each, no knowledge of the product.
///
/// Nothing here imports from `composites`, `layouts` or `pages`, and nothing
/// here knows what a queue or a project is. A component that has heard of
/// the domain is a component that can only be used once.
export { Button, buttonStyle } from "@/components/button";
export { Heading, Text, Mono, Quote } from "@/components/text";
export { Card, CardHeader, CardBody } from "@/components/card";
export { Input } from "@/components/input";
export { Badge } from "@/components/badge";
export { Dialog, DialogTrigger, DialogClose, DialogFrame } from "@/components/dialog";
export { Select, type Choice } from "@/components/select";
export { Toggle } from "@/components/toggle";
export { Disclosure } from "@/components/disclosure";
export { Label } from "@/components/label";
export { Mark } from "@/components/mark";
export { Pips } from "@/components/pips";
export { Popover } from "@/components/popover";
export { Prose, type ProseBlock, type ProseSpan } from "@/components/prose";
export { RowButton } from "@/components/row-button";
export { Facts, type Fact } from "@/components/facts";
export {
  CodeBlock,
  CodeGap,
  PlainText,
  type CodeLine,
  type CodeSegment,
} from "@/components/code-block";
