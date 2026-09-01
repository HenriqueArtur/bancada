import { PlusIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Heading, Text } from "@/components";
import { Inset, Row, Stack } from "@/frame";
import { cn } from "@/lib/cn";

/// The place where something is made, said out loud.
///
/// A form under a list looks like more of the list. It reads as another row
/// with empty fields, and the only thing distinguishing "here is what you
/// have" from "here is where you add one" was the submit button at the
/// bottom — which is the last thing anybody reads.
///
/// A dashed edge rather than a card: this is an outline of a thing that does
/// not exist yet, and it should not sit at the same weight as the things
/// that do.
export function NewThing({
  title,
  blurb,
  editing,
  children,
  className,
}: {
  title: string;
  blurb?: string;
  /// When it is filling in an existing thing rather than making one, it
  /// stops pretending to be an empty outline and says whose it is.
  editing?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Stack
      gap="normal"
      className={cn(
        "rounded-card border",
        editing ? "border-clay/45 bg-raised shadow-raised" : "border-dashed border-line bg-transparent",
        className,
      )}
    >
      <Inset pad="loose">
        <Stack gap="normal">
          <Stack gap="none">
            <Row gap="tight" align="baseline">
              {editing ? null : <PlusIcon size={14} className="text-ink-faint" />}
              <Heading level={3} as="h3">
                {editing ? `Editing ${editing}` : title}
              </Heading>
            </Row>
            {blurb && !editing ? (
              <Text size="sm" tone="faint">
                {blurb}
              </Text>
            ) : null}
          </Stack>
          {children}
        </Stack>
      </Inset>
    </Stack>
  );
}
