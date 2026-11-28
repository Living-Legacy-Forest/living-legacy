import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ChevronRightIcon } from '@/components/icons';
import { type SettingsNavItem, settingsNavFor } from '@/lib/settings-nav';
import type { SessionUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { sheetGroupClass } from '@/components/shell/sheet-parts';

/**
 * Phones list every page. An item whose first page is itself (Appearance) also gets a row for
 * each page after it; one that opens a list of its own (Legal) stays a single row.
 */
function phoneRows(items: SettingsNavItem[]) {
  return items.flatMap((item) =>
    item.children && item.children[0]?.to === item.to
      ? [
          item,
          ...item.children.slice(1).map((c) => ({
            ...item,
            to: c.to,
            title: `${item.title}, ${c.title.toLowerCase()}`,
          })),
        ]
      : [item]
  );
}

/**
 * Where /settings lands. From md the sidebar already lists every page, so this opens the first
 * of them; on phones, which have no sidebar, it is the list itself, as iOS Settings is.
 */
export function SettingsIndex({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const groups = settingsNavFor(user);
  // The site's own pages first, as Settings has always opened; your own pages if there are none.
  const items = groups.flatMap((g) => g.items);
  const first = (items.find((i) => i.to.startsWith('/settings/')) ?? items[0])?.to;

  useEffect(() => {
    if (!first || !window.matchMedia('(min-width: 48rem)').matches) return;
    void navigate({ to: first, replace: true });
  }, [first, navigate]);

  return (
    <div data-slot="stack-page" className="mx-auto w-full max-w-3xl space-y-6">
      <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight max-md:px-4">
        Settings
      </h1>
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-1.5 px-4 text-[0.8125rem] text-(--ios-secondary) uppercase">
            {group.label}
          </h2>
          <ul className={cn(sheetGroupClass, 'md:hidden')}>
            {phoneRows(group.items).map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex min-h-11 w-full items-center gap-3 px-4 text-[1.0625rem] transition-colors active:bg-(--ios-fill) [&_svg]:size-5.5"
                >
                  <item.icon aria-hidden className="text-(--ios-secondary)" />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <ChevronRightIcon
                    aria-hidden
                    className="size-4 text-(--ios-secondary) opacity-60"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
