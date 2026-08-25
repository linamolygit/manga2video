import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[opacity,transform,background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-paper text-paper-fg hover:opacity-90",
        secondary:
          "bg-surface-2 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-surface",
        ghost: "text-muted hover:text-fg hover:bg-surface-2",
        danger: "text-danger shadow-[0_0_0_1px_rgba(196,92,74,0.45)] hover:bg-danger/10",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
