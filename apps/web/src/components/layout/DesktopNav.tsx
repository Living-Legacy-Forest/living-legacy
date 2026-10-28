import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { NAV_ITEMS } from '@/components/layout/nav-links';

// Desktop nav: dropdown items (About, Locations) use Trigger + Content;
// plain items (How it works, Contact, Blog) render as a NavigationMenuLink
// styled the same as a trigger. Hover/focus lean on the palette tokens
// (text-foreground, bg-accent, moss-deep) rather than the component's
// default muted tones, to match the paper/ink site chrome.
const itemClass =
  'bg-transparent text-foreground hover:bg-accent hover:text-moss-deep focus:bg-accent data-popup-open:bg-accent/60 data-popup-open:hover:bg-accent data-open:bg-accent/60 data-open:hover:bg-accent data-open:focus:bg-accent';

export default function DesktopNav() {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
      <NavigationMenu>
        <NavigationMenuList>
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <NavigationMenuItem key={item.label}>
                <NavigationMenuTrigger className={itemClass}>{item.label}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="w-56 p-1">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <NavigationMenuLink
                          render={<a href={child.href} />}
                          className="text-ink-soft hover:bg-accent hover:text-moss-deep"
                        >
                          {child.label}
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            ) : (
              <NavigationMenuItem key={item.label}>
                <NavigationMenuLink
                  render={<a href={item.href} />}
                  className={cn(navigationMenuTriggerStyle(), itemClass)}
                >
                  {item.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            )
          )}
        </NavigationMenuList>
      </NavigationMenu>
      <a href="/contact/" className={buttonVariants({ size: 'sm' })}>
        Learn more
      </a>
    </nav>
  );
}
