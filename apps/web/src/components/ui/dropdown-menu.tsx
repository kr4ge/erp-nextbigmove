"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className = "", sideOffset = 4, align = "end", ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={`z-[9999] min-w-[8rem] overflow-visible rounded-lg border border-[#E2E8F0] bg-white p-0 text-foreground shadow-2xl dark:border-border dark:bg-surface ${className}`}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className = "", ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={`relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] dark:hover:bg-background-secondary dark:focus:bg-background-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className = "", ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={`-mx-1 my-1 h-px bg-[#E2E8F0] dark:bg-border ${className}`}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
