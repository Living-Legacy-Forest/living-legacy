import * as React from 'react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  type DrawerContentProps,
  DrawerDescription,
  type DrawerProps,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// On phones a popover is a bottom sheet, in reach of a thumb and never squeezed against the
// screen's edge, as Dialog is. Its parts read this to render the sheet's parts instead.
const AsSheet = React.createContext(false);

function Popover({ onOpenChange, ...props }: PopoverPrimitive.Root.Props) {
  const isPhone = useIsMobile();
  if (isPhone) {
    // Drawer is a Dialog; the open state and its change handler mean the same to both.
    return (
      <AsSheet value>
        <Drawer
          {...(props as DrawerProps)}
          onOpenChange={onOpenChange as DrawerProps['onOpenChange']}
        />
      </AsSheet>
    );
  }
  return <PopoverPrimitive.Root data-slot="popover" onOpenChange={onOpenChange} {...props} />;
}

function PopoverTrigger({
  openOnHover,
  delay,
  closeDelay,
  ...props
}: PopoverPrimitive.Trigger.Props) {
  const asSheet = React.useContext(AsSheet);
  // A touch screen has no hover, so a sheet opens on tap only.
  if (asSheet) {
    return (
      <DrawerTrigger
        {...(props as React.ComponentProps<typeof DrawerTrigger>)}
        data-slot="popover-trigger"
      />
    );
  }
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      openOnHover={openOnHover}
      delay={delay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

function PopoverContent({
  className,
  align = 'center',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  const asSheet = React.useContext(AsSheet);
  if (asSheet) {
    const { children, ...rest } = props;
    return (
      <DrawerContent {...(rest as DrawerContentProps)} className="bg-(--ios-sheet)">
        <DrawerBody
          data-slot="popover-content"
          className={cn(
            'flex flex-col gap-3 text-sm',
            className,
            // A popover's width and padding are sized for a corner of the desktop; the sheet
            // takes the screen's width and keeps clear of the home indicator.
            'w-full max-w-none px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]'
          )}
        >
          {children as React.ReactNode}
        </DrawerBody>
      </DrawerContent>
    );
  }
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-1 data-[side=inline-end]:slide-in-from-left-1 data-[side=inline-start]:slide-in-from-right-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-97 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-98 z-50 flex w-72 origin-(--transform-origin) flex-col gap-3 rounded-[10px] p-3.5 text-sm shadow-md outline-hidden ease-[cubic-bezier(0.16,1,0.3,1)] data-closed:duration-100 data-open:duration-150',
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex flex-col gap-0.5 text-sm', className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  const asSheet = React.useContext(AsSheet);
  if (asSheet) {
    return (
      <DrawerTitle
        className={cn('font-medium', className)}
        {...(props as React.ComponentProps<typeof DrawerTitle>)}
      />
    );
  }
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('font-medium', className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  const asSheet = React.useContext(AsSheet);
  if (asSheet) {
    return (
      <DrawerDescription
        className={cn('text-muted-foreground', className)}
        {...(props as React.ComponentProps<typeof DrawerDescription>)}
      />
    );
  }
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
