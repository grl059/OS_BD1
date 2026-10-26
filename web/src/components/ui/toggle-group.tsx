"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root className={cn("inline-flex gap-1 rounded-md bg-muted p-1", className)} {...props} />;
}

export function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-sm px-3 text-sm font-medium transition-colors data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:bg-accent",
        className,
      )}
      {...props}
    />
  );
}
