import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/// A raised surface. The only container that casts a shadow.
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-raised border border-line rounded-card shadow-raised overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 py-3 border-b border-line-soft", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
