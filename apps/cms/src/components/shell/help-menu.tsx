import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ExternalLink,
  GiftIcon,
  KeyboardIcon,
  MoreHorizontalIcon,
  PaletteIcon,
} from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { footerLinks } from '@/lib/nav';
import { whatsNew } from '@/lib/whats-new';
import { useThemeChoice } from '@/lib/use-theme-choice';
import { cn } from '@/lib/utils';
import { AppearancePicker } from './appearance-row';
import { ShortcutsDialog } from './shortcuts-dialog';
import { CurrentThemeIcon, useShowingTheme } from './theme-icon';
import { SidebarRow } from './sidebar-row';
import { useUpdates } from './updates';

const item =
  'text-ui hover:bg-accent focus-visible:bg-accent flex min-h-8 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

/**
 * The one-column sidebar's tools, gathered in a menu at its foot, as Linear keeps its help: What's
 * new, shortcuts, light or dark, appearance and the website, then the latest notes. The
 * two-column sidebar lists the same things as rows in its rail.
 */
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const { unseen } = useUpdates();
  const theme = useThemeChoice();
  const showing = useShowingTheme();
  const next = showing === 'dark' ? 'light' : 'dark';
  const site = footerLinks[0];
  const latest = whatsNew.slice(0, 3);
  const notes = [
    ...latest.map((entry) => ({ key: entry.id, label: entry.title })),
    { key: 'all', label: 'Everything new' },
  ];

  return (
    <>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <SidebarRow
            icon={MoreHorizontalIcon}
            label="Help and more"
            wide
            render={<PopoverTrigger />}
            trailing={
              unseen.length > 0 && (
                <span aria-label="New" className="bg-brand size-1.5 shrink-0 rounded-full" />
              )
            }
          />
          <PopoverContent side="top" align="start" sideOffset={8} className="w-64 gap-0.5 p-1.5">
            <Link to="/whats-new" className={item} onClick={() => setOpen(false)}>
              <GiftIcon aria-hidden />
              What&apos;s new
              {unseen.length > 0 && (
                <span aria-label="New" className="bg-brand ml-auto size-1.5 rounded-full" />
              )}
            </Link>
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                setShortcuts(true);
              }}
            >
              <KeyboardIcon aria-hidden />
              Keyboard shortcuts
            </button>
            <button type="button" className={item} onClick={() => void theme.choose(next)}>
              <CurrentThemeIcon />
              {next === 'dark' ? 'Switch to dark' : 'Switch to light'}
            </button>
            {/* Its own popover, so the colour and grain controls open beside this menu. */}
            <Popover>
              <PopoverTrigger className={item}>
                <PaletteIcon aria-hidden />
                Appearance
              </PopoverTrigger>
              <PopoverContent side="right" align="end" sideOffset={10} className="w-64 gap-3 p-3">
                <AppearancePicker />
              </PopoverContent>
            </Popover>
            {site && (
              <a href={site.href} target="_blank" rel="noreferrer" className={item}>
                <ExternalLink aria-hidden />
                {site.title}
              </a>
            )}

            {latest.length > 0 && (
              <div className="mt-1 pt-2">
                <p className="text-muted-foreground px-2 pb-1 text-xs font-medium">
                  What&apos;s new
                </p>
                <ul className="flex flex-col">
                  {notes.map((note, index) => (
                    <li key={note.key} className="flex items-stretch">
                      {/* The dots and their line sit in a column of their own, so a row's hover
                          colour starts at its text and never reaches them. Each piece of line
                          leaves 4px at both ends and holds 5 whole 2px dashes. */}
                      <span aria-hidden className="relative w-7 shrink-0">
                        <span className="bg-muted-foreground/70 absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
                        {index < notes.length - 1 && (
                          <span className="absolute top-[calc(50%+7px)] left-1/2 h-[calc(100%-14px)] w-px -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,color-mix(in_oklab,var(--muted-foreground)_45%,transparent)_0_2px,transparent_2px_4px)]" />
                        )}
                      </span>
                      <Link
                        to="/whats-new"
                        className={cn(item, 'min-w-0 flex-1 py-1.5')}
                        onClick={() => setOpen(false)}
                      >
                        <span className="min-w-0 truncate">{note.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}
