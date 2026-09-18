"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle,
  hideClose,
  side,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
  hideTitle?: boolean;
  hideClose?: boolean;
  side?: "left";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade" />
      <DialogPrimitive.Content
        className={cn(
          side === "left"
            ? "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-line bg-surface shadow-pop animate-fade"
            : "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-pop animate-pop scrollbar-thin",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className={cn("text-base font-semibold tracking-tight", hideTitle && "sr-only")}>{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className={cn("mt-1 text-sm text-ink-2", hideTitle && "sr-only")}>{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
