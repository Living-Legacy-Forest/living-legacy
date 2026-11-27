'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import { SearchIcon, CheckIcon } from '@/components/icons';
import { GlideHighlight } from '@/components/ui/glide-highlight';

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'bg-popover text-popover-foreground flex size-full flex-col overflow-hidden rounded-xl! p-1',
        className
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        // Its own short motion, instead of the dialog's stock zoom (styles.css).
        data-command=""
        className={cn('top-[12vh] translate-y-0 overflow-hidden rounded-xl! p-0', className)}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  bare = false,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  /**
   * No box: the field is the top of the surface it sits in, over a hairline, as in a search
   * dialog. The default is the small boxed field a popover's list has.
   */
  bare?: boolean;
}) {
  if (bare) {
    return (
      <div data-slot="command-input-wrapper" className="flex h-12 items-center gap-3 border-b px-4">
        <SearchIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            'placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-base outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-[0.9375rem]',
            className
          )}
          {...props}
        />
      </div>
    );
  }
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="bg-input/30 has-[[data-slot=input-group-control]:focus-visible]:bg-input/50 h-8! rounded-lg! border-transparent shadow-none! has-[[data-slot=input-group-control]:focus-visible]:ring-0 *:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            'w-full text-xs outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none',
        className
      )}
      {...props}
    >
      {/* cmdk marks the active item data-selected="true"; one highlight glides between them. */}
      <GlideHighlight
        selector="[data-selected=true]"
        className="bg-muted rounded-sm in-data-[slot=dialog-content]:rounded-lg"
      />
      {children}
    </CommandPrimitive.List>
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('py-6 text-center text-xs', className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        'text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium',
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('-mx-1 my-0.5 h-px bg-transparent', className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item data-selected:text-foreground data-selected:*:[svg]:text-foreground relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        'text-muted-foreground group-data-selected/command-item:text-foreground ml-auto text-xs tracking-widest',
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
