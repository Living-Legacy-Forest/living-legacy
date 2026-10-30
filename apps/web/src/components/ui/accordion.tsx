import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn('flex w-full flex-col', className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b', className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group/accordion-trigger font-heading hover:text-moss-deep focus-visible:ring-ring/50 relative flex flex-1 items-center justify-between gap-6 rounded-lg py-6 text-left text-lg leading-snug font-normal tracking-tight transition-colors duration-200 outline-none focus-visible:ring-3 aria-disabled:pointer-events-none aria-disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
        <HugeiconsIcon
          icon={PlusSignIcon}
          data-slot="accordion-trigger-icon"
          className="text-moss pointer-events-none size-5 shrink-0 transition-transform duration-200 ease-[var(--ease-grow)] group-aria-expanded/accordion-trigger:rotate-45"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

// Closed panels stay in the HTML (hiddenUntilFound), so answers are indexable,
// findable with the browser's find-in-page, and present before hydration.
function AccordionContent({
  className,
  children,
  hiddenUntilFound = true,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      hiddenUntilFound={hiddenUntilFound}
      className="data-open:animate-accordion-down data-closed:animate-accordion-up text-muted-foreground overflow-hidden text-base leading-[1.618]"
      {...props}
    >
      <div
        className={cn(
          '[&_a]:text-moss-deep [&_a]:hover:text-foreground h-(--accordion-panel-height) max-w-3xl pt-0 pb-6 data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4',
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
