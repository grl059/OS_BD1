"use client";

import * as React from "react";
import { Toggle as TogglePrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
  {
    variants: {
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2 text-xs",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export function Toggle({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root className={cn(toggleVariants({ size }), className)} {...props} />;
}
