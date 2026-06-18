"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetDescription = DialogPrimitive.Description;
export const SheetTitle = DialogPrimitive.Title;

export function SheetPopup({
  className,
  side = "right",
  children,
  ...props
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed z-50 flex flex-col bg-card shadow-lg outline-none",
          "data-ending-style:transition-transform data-starting-style:transition-transform",
          "data-ending-style:duration-200 data-starting-style:duration-200",
          "data-ending-style:ease-out data-starting-style:ease-out",
          side === "left" && "left-0 top-0 bottom-0 w-72 data-starting-style:-translate-x-full",
          side === "right" && "right-0 top-0 bottom-0 w-72 data-starting-style:translate-x-full",
          side === "top" && "top-0 left-0 right-0 data-starting-style:-translate-y-full",
          side === "bottom" && "bottom-0 left-0 right-0 data-starting-style:translate-y-full",
          className,
        )}
        data-slot="sheet-popup"
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 px-4 pt-4 pb-2", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

export function SheetPanel({ className, ...props }) {
  return (
    <div
      className={cn("flex-1 overflow-auto px-4 py-2", className)}
      data-slot="sheet-panel"
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 px-4 pb-4 pt-2", className)}
      data-slot="sheet-footer"
      {...props}
    />
  );
}
