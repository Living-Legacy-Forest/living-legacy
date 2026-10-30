import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Menu01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NAV_ITEMS } from '@/components/layout/nav-links';

// Anchor links such as /#about-section navigate within the same document when
// already on the home page, which leaves the sheet open over a page that has
// silently scrolled underneath it. Closing on every link click keeps that in
// sync regardless of which kind of navigation actually happens.
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" />}>
        <HugeiconsIcon icon={Menu01Icon} aria-hidden="true" />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>
      <SheetContent side="right" className="data-[side=right]:w-full">
        <SheetHeader className="border-border border-b">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <a
            href="/"
            onClick={close}
            aria-label="Living Legacy Forest home"
            className="font-display text-moss-deep text-lg"
          >
            Living Legacy Forest
          </a>
        </SheetHeader>

        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div key={item.label} className="border-border border-b py-2 first:pt-0">
                <p className="text-foreground px-2 py-2 text-base font-medium">{item.label}</p>
                <div className="flex flex-col gap-1 pb-1 pl-2">
                  {item.children.map((child) => (
                    <a
                      key={child.label}
                      href={child.href}
                      onClick={close}
                      className="text-ink-soft hover:bg-accent hover:text-moss-deep rounded-lg px-2 py-2 text-base transition-colors"
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <a
                key={item.label}
                href={item.href}
                onClick={close}
                className="text-foreground hover:bg-accent hover:text-moss-deep border-border border-b px-2 py-3 text-base font-medium transition-colors first:pt-0"
              >
                {item.label}
              </a>
            )
          )}
        </nav>

        <SheetFooter>
          <a
            href="/contact/"
            onClick={close}
            className={cn(buttonVariants({ size: 'default' }), 'justify-center')}
          >
            Learn more
          </a>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
