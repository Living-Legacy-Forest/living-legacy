import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ArrowRightIcon, CopyIcon, ExternalLinkIcon, PanelLeftIcon } from '@/components/icons';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { copyText } from '@/lib/site';

const ITEM = "text-ui gap-2 py-1.5 [&_svg:not([class*='size-'])]:size-3.5";

/** One thing a sidebar menu can do: pin, move, hide, bring back. */
export type NavAction = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

function Actions({ actions }: { actions: NavAction[] }) {
  return actions.map((action) => (
    <ContextMenuItem
      key={action.label}
      className={ITEM}
      disabled={action.disabled}
      onClick={action.onSelect}
    >
      {action.icon}
      {action.label}
    </ContextMenuItem>
  ));
}

/**
 * Right-click (or long-press) on a section or page: where it goes, then how this person has it
 * set. Replacing the browser's own menu on a link would lose "Open in new tab" and "Copy link",
 * so both are here too.
 */
export function NavLinkMenu({
  to,
  actions = [],
  children,
}: {
  to: string;
  actions?: NavAction[];
  children: ReactNode;
}) {
  const router = useRouter();
  const href = () => router.buildLocation({ to }).href;

  return (
    <ContextMenu>
      <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-52 p-1.5">
        <ContextMenuItem className={ITEM} onClick={() => void router.navigate({ to })}>
          <ArrowRightIcon aria-hidden />
          Open
        </ContextMenuItem>
        <ContextMenuItem
          className={ITEM}
          onClick={() => window.open(href(), '_blank', 'noopener,noreferrer')}
        >
          <ExternalLinkIcon aria-hidden />
          Open in new tab
        </ContextMenuItem>
        <ContextMenuItem
          className={ITEM}
          onClick={() => void copyText(new URL(href(), window.location.origin).href, 'Link')}
        >
          <CopyIcon aria-hidden />
          Copy link
        </ContextMenuItem>
        {actions.length > 0 && <ContextMenuSeparator />}
        <Actions actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** A menu of actions on whatever is right-clicked, such as a section's heading. */
export function ActionMenu({ actions, children }: { actions: NavAction[]; children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-52 p-1.5">
        <Actions actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Right-click anywhere else in a column: widen or narrow it, and put the sidebar back as it was. */
export function ColumnMenu({
  label,
  onToggle,
  actions = [],
  children,
}: {
  label: string;
  onToggle: () => void;
  actions?: NavAction[];
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-52 p-1.5">
        <ContextMenuItem className={ITEM} onClick={onToggle}>
          <PanelLeftIcon aria-hidden />
          {label}
        </ContextMenuItem>
        {actions.length > 0 && <ContextMenuSeparator />}
        <Actions actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
