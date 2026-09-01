import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/// Rows of the same shape. No zebra, no chrome, one hairline between.
export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-line-soft last:border-0", className)} {...props} />;
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("py-2.5 pr-3.5 align-middle", className)} {...props} />;
}
