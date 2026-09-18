import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-ink text-bg hover:bg-ink/85 border border-transparent",
  accent: "bg-accent text-accent-contrast hover:brightness-110 border border-transparent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2 border border-transparent",
  outline: "bg-transparent text-ink border border-line-strong hover:border-ink/40",
  danger: "bg-bad-soft text-bad-ink border border-transparent hover:bg-bad hover:text-white",
} as const;

const SIZES = {
  xs: "h-7 px-2 text-xs gap-1.5 rounded-[5px]",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-md",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-lg",
  icon: "h-9 w-9 rounded-md",
  "icon-sm": "h-8 w-8 rounded-md",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", asChild, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background,color,border,filter,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});
