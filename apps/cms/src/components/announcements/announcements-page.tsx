import {
  ANNOUNCEMENT_MOBILE_LENGTH,
  ANNOUNCEMENT_MOBILE_LENGTH_WITH_BUTTON,
  type AnnouncementBackground,
  type AnnouncementStatus,
  announcementBackgrounds,
  announcementClashes,
  announcementColours,
  announcementContrast,
  announcementStatus,
} from '@ll/content';
import { useEffect, useState } from 'react';
import { type ColorSwatch, ColorPicker } from '@/components/arc/color-picker/color-picker';
import { CardMeta, ListCard, ListCards } from '@/components/list/list-card';
import { ListFilter } from '@/components/list/list-filter';
import { ListSort, byNumber, byText, sortedBy, useListSort } from '@/components/list/list-sort';
import { useListView } from '@/components/list/view-switch';
import { ListDisplay } from '@/components/list/list-display';
import { DateTimePicker } from '@/components/date-time-picker';
import { FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { PageActions } from '@/components/shell/page-actions';
import {
  DialogActions,
  ListColumn,
  ListDialog,
  ListPageLayout,
  ListRows,
  NoMatches,
  PaneActions,
  PaneColumn,
  PaneEmpty,
  PaneFrame,
  isDesktop,
  useFormDirty,
  useListPane,
} from '@/components/list/list-page';
import { SaveButton, useSaveFeedback } from '@/components/list/save-button';
import { LeaveDialog } from '@/components/editor-page/leave-dialog';
import { ListRow, type RowMenuItem } from '@/components/list/list-row';
import {
  ToolbarSearch,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import {
  CalendarClockIcon,
  CopyIcon,
  PanelRightIcon,
  EyeOffIcon,
  MegaphoneIcon,
  PlusIcon,
  SendIcon,
  TextQuote,
  TriangleAlertIcon,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Iphone } from '@/components/ui/iphone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, zoneName } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { deletedNotice, restoredNotice } from '@/lib/notify';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { useTimeZone } from '@/lib/use-time-zone';
import { notify } from '@/lib/notify';
import { readPaneOpen } from '@/lib/list-view';
import { cn } from '@/lib/utils';
import {
  type Announcement,
  type AnnouncementsData,
  deleteAnnouncements,
  restoreAnnouncements,
  saveAnnouncement,
} from '@/server/announcements';
import {
  rowPasses,
  upcomingFacts,
  upcomingOptions,
  type MatchMode,
} from '@/components/list/filter-tools';

const NOUN: [string, string] = ['announcement', 'announcements'];

/** The website's palette (apps/web global.css), offered as one-tap swatches in the picker. */
const palette: { value: (typeof announcementBackgrounds)[number]; label: string }[] = [
  { value: 'moss', label: 'Moss (deep green)' },
  { value: 'ink', label: 'Ink (near black)' },
  { value: 'sun', label: 'Sun (warm gold)' },
  { value: 'paper', label: 'Paper (soft cream)' },
];

/** What the list filters by: a palette name, or "custom" for any colour picked freely. */
const colourKind = (background: string) =>
  (announcementBackgrounds as readonly string[]).includes(background) ? background : 'custom';

/** Picker colours are hex, with two more digits when not opaque; the bar is always opaque. */
const opaqueHex = (hex: string) => hex.slice(0, 7).toLowerCase();

/** A palette colour keeps its name, so the website shows it with its own styling. */
function backgroundFromHex(hex: string): AnnouncementBackground {
  const value = opaqueHex(hex);
  const match = announcementBackgrounds.find((name) => announcementColours(name).bg === value);
  return match ?? (value as AnnouncementBackground);
}

const statusLabels: Record<AnnouncementStatus, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  ended: 'Ended',
  off: 'Off',
};

/** Live first, then upcoming in date order, then switched off, then finished. */
const statusOrder: Record<AnnouncementStatus, number> = { live: 0, scheduled: 1, off: 2, ended: 3 };

function windowLabel(a: Pick<Announcement, 'startsAt' | 'endsAt'>, zone: string) {
  const from = a.startsAt === null ? 'Now' : formatDateTime(a.startsAt, zone);
  const to = a.endsAt === null ? 'no end' : formatDateTime(a.endsAt, zone);
  return `${from} to ${to}`;
}

type Target = { kind: 'edit'; id: string } | { kind: 'new'; from?: Announcement };

/** A group of fields; its legend is the heading, and on phones the group's small heading. */
const FIELDSET = 'space-y-3 [--form-gap:0.75rem] max-md:space-y-0';
const LEGEND =
  'mb-2 text-xs font-medium max-md:mb-0 max-md:px-4 max-md:pb-1.5 max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase';

const SORTS = [
  { value: 'status', label: 'Status, then start date' },
  { value: 'start-new', label: 'Newest start' },
  { value: 'start-old', label: 'Oldest start' },
  { value: 'title-az', label: 'Title, A to Z' },
  { value: 'title-za', label: 'Title, Z to A' },
] as const;

export function AnnouncementsPage({
  data,
  canWrite,
  initialEdit,
  onOpenedInitial,
}: {
  data: AnnouncementsData;
  canWrite: boolean;
  /** An announcement to open on arrival. */
  initialEdit?: string;
  onOpenedInitial?: () => void;
}) {
  const view = useListPane<Target>();
  useEffect(() => {
    if (!initialEdit) return;
    if (canWrite && data.some((a) => a.id === initialEdit)) {
      view.open({ kind: 'edit', id: initialEdit });
    }
    onOpenedInitial?.();
    // Only on arrival with ?edit=, not on every render that has it.
  }, [initialEdit]);
  const [query, setQuery] = useState('');
  // Ticked values per filter group; an empty group does not narrow the list.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [match, setMatch] = useState<MatchMode>('all');
  const [layout, setLayout] = useListView('announcements');
  // The edit pane can fold away to give the list the full width; the choice is remembered.
  // Cards take the full width, so Grid starts with the editor folded away.
  const [paneOpen, setPaneOpenState] = useState(
    () => readPaneOpen('announcements') && layout !== 'grid'
  );
  // Choosing an announcement or preparing one brings the editor back.
  useEffect(() => {
    if (view.pane) setPaneOpenState(true);
  }, [view.pane]);
  const setPaneOpen = (open: boolean) => {
    setPaneOpenState(open);
    document.cookie = `announcements_pane=${open ? 'open' : 'closed'}; path=/; max-age=31536000; samesite=lax`;
  };
  // The menu's Open always shows the editor; it never closes it.
  const showRow = (id: string) => {
    if (!canWrite) return;
    setPaneOpen(true);
    view.open({ kind: 'edit', id });
  };
  // As on Posts: the open row closes the editor, any other row opens it.
  const openRow = (id: string) => {
    if (!canWrite) return;
    if (isDesktop() && paneOpen && view.pane?.kind === 'edit' && view.pane.id === id) {
      return setPaneOpen(false);
    }
    setPaneOpen(true);
    view.open({ kind: 'edit', id });
  };
  const grid = layout === 'grid';
  const selection = useSelection(data.map((a) => a.id));
  const clearFilters = () => {
    setPicked({});
    selection.clear();
  };
  const { run, pending } = useAction();
  const revealing = useRevealOnce();

  const now = Date.now();
  const status = (a: Announcement) => announcementStatus(a, now);
  const clashes = announcementClashes(data, now);
  const sorted = [...data].sort(
    (a, b) =>
      statusOrder[status(a)] - statusOrder[status(b)] || (a.startsAt ?? 0) - (b.startsAt ?? 0)
  );
  const [sort, setSort] = useListSort(SORTS);
  const ordered = sortedBy(sorted, sort, {
    'start-new': (a, b) => byNumber(b.startsAt, a.startsAt),
    'start-old': (a, b) => byNumber(a.startsAt, b.startsAt),
    'title-az': (a, b) => byText(a.title, b.title),
    'title-za': (a, b) => byText(b.title, a.title),
  });
  const visible = ordered.filter(
    (a) =>
      rowPasses(match, picked, {
        statuses: status(a),
        backgrounds: colourKind(a.background),
        starts: upcomingFacts(a.startsAt),
        ends: a.endsAt === null ? 'no' : 'yes',
      }) && matchesSearch(query, [a.title, a.message, a.messageTablet, a.messageDesktop])
  );

  const announcementMenu = (a: Announcement): RowMenuItem[] | undefined => {
    if (!canWrite) return undefined;
    const rowStatus = status(a);
    const items: RowMenuItem[] = [];
    if (rowStatus === 'off' || rowStatus === 'ended') {
      items.push({
        label: 'Publish',
        icon: <SendIcon aria-hidden />,
        disabled: pending,
        onSelect: () => quickPublish(a, rowStatus),
        shortcut: { key: 'p' },
      });
    }
    items.push({
      label: 'Duplicate',
      icon: <CopyIcon aria-hidden />,
      onSelect: () => view.open({ kind: 'new', from: a }),
      shortcut: { key: 'd' },
    });
    items.push({
      label: 'Copy message',
      icon: <TextQuote aria-hidden />,
      onSelect: () => copyMessage(a),
      shortcut: { key: 'c' },
    });
    if (rowStatus === 'live') {
      items.push({
        label: 'End now',
        icon: <CalendarClockIcon aria-hidden />,
        disabled: pending,
        onSelect: () => endNow(a),
        shortcut: { key: 'e' },
      });
    }
    if (rowStatus === 'live' || rowStatus === 'scheduled') {
      items.push({
        label: 'Switch off',
        icon: <EyeOffIcon aria-hidden />,
        disabled: pending,
        onSelect: () => switchOff(a),
        destructive: true,
        shortcut: { key: 'u' },
      });
    }
    return items;
  };

  const editing = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((a) => a.id === target.id) ?? null) : null;
  // An announcement removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !editing(view.pane) ? null : view.pane;

  // Straight away, with Undo on the toast, rather than asking first.
  async function remove(ids: string[]) {
    const result = await run(() => deleteAnnouncements({ data: { ids } }), {
      success: deletedNotice(
        ids.length,
        NOUN,
        () => restore(ids),
        `${ids.length === 1 ? 'It is' : 'They are'} gone from the website.`
      ),
      error: 'Could not delete',
    });
    if (!result) return false;
    view.closeIfShowing((t) => t.kind === 'edit' && ids.includes(t.id));
    selection.clear();
    return true;
  }

  const restore = (ids: string[]) =>
    run(() => restoreAnnouncements({ data: { ids } }), {
      success: restoredNotice(ids.length, NOUN),
      error: 'Could not bring it back',
    });

  async function copyMessage(a: Announcement) {
    try {
      await navigator.clipboard.writeText(a.message);
      notify.success({ title: 'Message copied', description: 'It is on your clipboard.' });
    } catch {
      notify.error('Could not copy the message', 'Your browser blocked access to the clipboard.');
    }
  }

  async function endNow(a: Announcement) {
    await run(() => saveAnnouncement({ data: { ...a, endsAt: Date.now() } }), {
      success: {
        title: 'Announcement ended',
        description: 'It no longer shows on the website.',
      },
      error: 'Could not end the announcement',
    });
  }

  async function switchOff(a: Announcement) {
    await run(() => saveAnnouncement({ data: { ...a, enabled: false } }), {
      success: {
        title: 'Announcement switched off',
        description: 'It is hidden, whatever its dates. Publish it to bring it back.',
      },
      error: 'Could not switch off the announcement',
    });
  }

  async function quickPublish(a: Announcement, currentStatus: AnnouncementStatus) {
    // Ended means its expiry already passed; clear it so publishing actually goes live.
    const endsAt = currentStatus === 'ended' ? null : a.endsAt;
    await run(() => saveAnnouncement({ data: { ...a, enabled: true, endsAt } }), {
      success: {
        title: 'Announcement published',
        description: 'It shows on the website within its dates.',
      },
      error: 'Could not publish the announcement',
    });
  }

  const form = (
    target: Target,
    onDone: (id: string | null) => void,
    footer: (submit: React.ReactNode) => React.ReactNode
  ) => (
    <AnnouncementForm
      key={target.kind === 'edit' ? target.id : `new-${target.from?.id ?? ''}`}
      announcement={editing(target)}
      copyOf={target.kind === 'new' ? target.from : undefined}
      others={data}
      onSaved={onDone}
      onDirtyChange={view.reportDirty}
      footer={footer}
    />
  );

  const newButton = (
    <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      Add announcement
    </Button>
  );

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3 md:gap-1.5">
        <h1 data-slot="page-title" className="mr-auto text-xl md:sr-only">
          <RevealWords text="Announcements" />
        </h1>
        <div className="mr-auto max-md:hidden" />
        {data.length > 0 && (
          <ToolbarSearch
            label="Search announcements"
            placeholder="Search names and messages"
            value={query}
            onChange={setQuery}
          />
        )}
        {data.length > 0 && (
          <ListSort options={SORTS} value={sort} onChange={setSort} hideOnDesktop />
        )}

        {data.length > 0 && (
          <ListDisplay
            filter={
              <ListFilter
                groups={[
                  {
                    key: 'statuses',
                    label: 'Status',
                    options: (Object.keys(statusOrder) as AnnouncementStatus[])
                      .sort((a, b) => statusOrder[a] - statusOrder[b])
                      .map((value) => ({ value, label: statusLabels[value] })),
                  },
                  {
                    key: 'backgrounds',
                    label: 'Colour',
                    options: [...palette, { value: 'custom', label: 'Custom colour' }],
                  },
                  { key: 'starts', label: 'Starts', options: upcomingOptions },
                  {
                    key: 'ends',
                    label: 'End date',
                    options: [
                      { value: 'yes', label: 'Has an end date' },
                      { value: 'no', label: 'Runs until turned off' },
                    ],
                  },
                ]}
                match={match}
                onMatchChange={setMatch}
                savedKey="announcements"
                values={picked}
                onChange={(key, next) => {
                  setPicked((prev) => ({ ...prev, [key]: next }));
                  selection.clear();
                }}
                onClear={clearFilters}
              />
            }
            sortOptions={SORTS}
            sortValue={sort}
            onSortChange={(next) => setSort(next as typeof sort)}
            value={layout}
            onChange={(next) => {
              setLayout(next);
              // Cards take the full width, as on Posts; the list brings the editor back.
              setPaneOpenState(next === 'list');
              selection.clear();
            }}
          />
        )}
        {data.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={paneOpen ? 'Hide the editor' : 'Show the editor'}
            aria-pressed={paneOpen}
            title={paneOpen ? 'Hide the editor' : 'Show the editor'}
            className="max-lg:hidden"
            onClick={() => setPaneOpen(!paneOpen)}
          >
            <PanelRightIcon open={paneOpen} aria-hidden />
          </Button>
        )}
        {canWrite && <div className="max-md:hidden">{newButton}</div>}
        {canWrite && (
          <PageActions
            edit={{
              editing: selection.selecting,
              onToggle: selection.selecting ? selection.clear : selection.startEditing,
            }}
            add={{ label: 'Add announcement', onClick: () => view.open({ kind: 'new' }) }}
          />
        )}
      </div>

      {data.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MegaphoneIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No announcements yet</EmptyTitle>
            <EmptyDescription>
              Prepare a banner for the top of the website, and schedule when it shows.
            </EmptyDescription>
          </EmptyHeader>
          {canWrite && <EmptyContent>{newButton}</EmptyContent>}
        </Empty>
      ) : (
        <ListPageLayout
          resizable={{ key: 'announcements', defaultShare: 0.5, active: paneOpen, animated: true }}
          className={cn(
            'motion-reduce:transition-none lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
            !paneOpen && 'lg:grid-cols-[1fr_0fr]'
          )}
        >
          <ListColumn
            className="lg:min-w-80"
            label="Announcements"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((a) => a.id)}
                title="All"
                total={data.length}
                pending={pending}
                onDelete={canWrite ? () => void remove(selection.checkedIds) : undefined}
              />
            }
          >
            {visible.length === 0 ? (
              <NoMatches
                onClear={() => {
                  setQuery('');
                  clearFilters();
                }}
              >
                No announcements match that search.
              </NoMatches>
            ) : grid ? (
              <ListCards>
                {visible.map((a) => (
                  <ListCard
                    key={a.id}
                    select={
                      canWrite
                        ? {
                            label: `Select ${a.title}`,
                            checked: selection.isChecked(a.id),
                            selecting: selection.selecting,
                            onToggle: () => selection.toggle(a.id),
                          }
                        : undefined
                    }
                    title={a.title}
                    largeTitle
                    current={pane?.kind === 'edit' && pane.id === a.id}
                    menu={announcementMenu(a)}
                    remove={
                      canWrite
                        ? { label: 'Delete', onAction: () => void remove([a.id]) }
                        : undefined
                    }
                    onOpen={() => openRow(a.id)}
                    menuOpen={() => showRow(a.id)}
                  >
                    <AnnouncementCardBody
                      announcement={a}
                      status={status(a)}
                      clashesWith={clashes.get(a.id) ?? []}
                    />
                  </ListCard>
                ))}
              </ListCards>
            ) : (
              <ListRows>
                {visible.map((a) => {
                  const rowStatus = status(a);
                  return (
                    <ListRow
                      key={a.id}
                      align="start"
                      current={pane?.kind === 'edit' && pane.id === a.id}
                      select={
                        canWrite
                          ? {
                              label: `Select ${a.title}`,
                              checked: selection.isChecked(a.id),
                              selecting: selection.selecting,
                              onToggle: () => selection.toggle(a.id),
                            }
                          : undefined
                      }
                      swipe={
                        canWrite
                          ? { label: 'Delete', onAction: () => void remove([a.id]) }
                          : undefined
                      }
                      trailing={
                        canWrite &&
                        (rowStatus === 'off' || rowStatus === 'ended') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => quickPublish(a, rowStatus)}
                          >
                            Publish
                          </Button>
                        )
                      }
                      menu={announcementMenu(a)}
                      onOpen={() => openRow(a.id)}
                      menuOpen={() => showRow(a.id)}
                    >
                      <AnnouncementSummary
                        announcement={a}
                        status={rowStatus}
                        clashesWith={clashes.get(a.id) ?? []}
                      />
                    </ListRow>
                  );
                })}
              </ListRows>
            )}
          </ListColumn>

          <PaneColumn
            label="Edit announcement"
            inert={!paneOpen}
            className={cn(
              'min-w-0 overflow-hidden transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              !paneOpen && 'translate-x-4 opacity-0'
            )}
          >
            {!canWrite || pane === null ? (
              <PaneEmpty
                title="No announcement selected"
                description="Choose one from the list, or prepare a new one."
              />
            ) : (
              <PaneFrame
                title={
                  pane.kind === 'edit'
                    ? (editing(pane)?.title ?? 'Announcement')
                    : pane.from
                      ? `Copy of ${pane.from.title}`
                      : 'New announcement'
                }
              >
                {form(
                  pane,
                  (id) => view.setPane(id ? { kind: 'edit', id } : null),
                  (submit) => (
                    <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                  )
                )}
              </PaneFrame>
            )}
          </PaneColumn>
        </ListPageLayout>
      )}

      <LeaveDialog blocker={view.leave} what="announcement" />

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          size="lg"
          title={view.dialog?.kind === 'edit' ? 'Edit announcement' : 'New announcement'}
          description="A banner across the top of the website."
        >
          {view.dialog &&
            form(view.dialog, view.dismissDialog, (submit) => (
              <DialogActions>{submit}</DialogActions>
            ))}
        </ListDialog>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AnnouncementStatus }) {
  return (
    <Badge
      variant={status === 'live' ? 'default' : status === 'scheduled' ? 'secondary' : 'outline'}
      className={cn('shrink-0', status === 'ended' && 'text-muted-foreground')}
    >
      {statusLabels[status]}
    </Badge>
  );
}

/** Under a card's title: status, the banner's colour and message, and when it shows. */
function AnnouncementCardBody({
  announcement: a,
  status,
  clashesWith,
}: {
  announcement: Announcement;
  status: AnnouncementStatus;
  clashesWith: Announcement[];
}) {
  const timeZone = useTimeZone();
  return (
    <>
      <span className="flex items-center gap-2">
        <StatusBadge status={status} />
        {clashesWith.length > 0 && (
          <TriangleAlertIcon
            aria-label={`Overlaps with ${clashesWith.map((c) => c.title).join(', ')}`}
            className="text-warning-text size-3.5 shrink-0"
          />
        )}
      </span>
      <CardMeta>
        <span className="tabular-nums">{windowLabel(a, timeZone)}</span>
      </CardMeta>
    </>
  );
}

function AnnouncementSummary({
  announcement: a,
  status,
  clashesWith,
}: {
  announcement: Announcement;
  status: AnnouncementStatus;
  clashesWith: Announcement[];
}) {
  const colour = announcementColours(a.background);
  const timeZone = useTimeZone();

  return (
    <span className={cn('block', (status === 'ended' || status === 'off') && 'opacity-60')}>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="ring-border size-2.5 shrink-0 rounded-full ring-1"
          style={{ background: colour.bg }}
        />
        <span className="text-ui min-w-0 flex-1 truncate font-medium">{a.title}</span>
        {clashesWith.length > 0 && (
          <TriangleAlertIcon
            aria-label={`Overlaps with ${clashesWith.map((c) => c.title).join(', ')}`}
            className="text-warning-text size-3.5 shrink-0"
          />
        )}
        <StatusBadge status={status} />
      </span>
      <span className="text-muted-foreground mt-0.5 block truncate text-xs">{a.message}</span>
      <span className="text-muted-foreground mt-0.5 block truncate text-xs tabular-nums">
        {windowLabel(a, timeZone)}
      </span>
    </span>
  );
}

function AnnouncementForm({
  announcement,
  copyOf,
  others,
  onSaved,
  onDirtyChange,
  footer,
}: {
  announcement: Announcement | null;
  /** Start from this one's content; dates are cleared and it starts switched off. */
  copyOf?: Announcement;
  others: Announcement[];
  onSaved: (id: string | null) => void;
  onDirtyChange: (dirty: boolean) => void;
  footer: (submit: React.ReactNode) => React.ReactNode;
}) {
  const source = announcement ?? copyOf;
  const [values, setValues] = useState({
    title: announcement?.title ?? (copyOf ? `${copyOf.title} (copy)` : ''),
    enabled: announcement?.enabled ?? !copyOf,
    message: source?.message ?? '',
    messageTablet: source?.messageTablet ?? '',
    messageDesktop: source?.messageDesktop ?? '',
    ctaLabel: source?.ctaLabel ?? '',
    ctaUrl: source?.ctaUrl ?? '',
    background: (source?.background ?? 'moss') as AnnouncementBackground,
    startsAt: announcement?.startsAt ?? null,
    endsAt: announcement?.endsAt ?? null,
    hidePaths: (source?.hidePaths ?? []).join('\n'),
  });
  // The site shows the button only with both a label and a link.
  const hasButton = Boolean(values.ctaLabel.trim() && values.ctaUrl.trim());
  const mobileLimit = hasButton
    ? ANNOUNCEMENT_MOBILE_LENGTH_WITH_BUTTON
    : ANNOUNCEMENT_MOBILE_LENGTH;
  const { run, pending } = useAction();
  const form = useFormDirty(values, onDirtyChange);
  const feedback = useSaveFeedback({ editing: announcement !== null, dirty: form.dirty });
  const patch = (next: Partial<typeof values>) => setValues((v) => ({ ...v, ...next }));

  const { startsAt, endsAt } = values;
  const hidePaths = values.hidePaths
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const draft = {
    id: announcement?.id ?? 'draft',
    enabled: values.enabled,
    startsAt,
    endsAt,
    hidePaths,
  };
  const now = Date.now();
  const rest = others.filter((o) => o.id !== draft.id);
  const overlapIds = new Set(
    (announcementClashes([...rest, draft], now).get(draft.id) ?? []).map((o) => o.id)
  );
  const overlaps = values.enabled ? rest.filter((o) => overlapIds.has(o.id)) : [];
  const timeZone = useTimeZone();
  const zone = zoneName(timeZone);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveAnnouncement({
          data: { ...values, id: announcement?.id, hidePaths },
        }),
      {
        success: feedback.toast({
          title: announcement ? 'Announcement saved' : 'Announcement created',
          description: 'It shows on the website while it is on and within its dates.',
        }),
        error: 'Could not save the announcement',
      }
    );
    // A form closed, replaced or edited again while it saved stays as it is now.
    if (!result || !form.markSaved(announcement === null)) return;
    feedback.saved();
    onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5 [--form-gap:1.25rem] max-md:space-y-7">
      <Tabs defaultValue="edit">
        <TabsList aria-label="Show">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        {/* Kept mounted, so nothing typed is lost and the preview is never stale. */}
        <TabsContent value="edit" keepMounted className="space-y-5 max-md:space-y-7">
          <FormSection>
            <FormCell label="Name" htmlFor="a-title">
              <Input
                id="a-title"
                required
                maxLength={80}
                value={values.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="e.g. Monthly promotion"
              />
            </FormCell>
            <FormSwitchCell
              id="a-enabled"
              label="Enabled"
              checked={values.enabled}
              onCheckedChange={(enabled) => patch({ enabled })}
            />
          </FormSection>

          <fieldset className={FIELDSET}>
            <legend className={LEGEND}>Message</legend>
            <FormSection>
              <FormCell
                label="Default (phones)"
                htmlFor="a-message"
                aside={
                  <span
                    className={cn(
                      'text-muted-foreground text-xs tabular-nums',
                      values.message.length > mobileLimit && 'text-warning-text'
                    )}
                  >
                    {values.message.length}/{mobileLimit}
                  </span>
                }
                info={`Keep under ${mobileLimit} characters to stay on one line on a phone${hasButton ? '' : `, or ${ANNOUNCEMENT_MOBILE_LENGTH_WITH_BUTTON} if you add a button`}. Larger screens use it too, unless replaced below.`}
              >
                <Input
                  id="a-message"
                  required
                  maxLength={160}
                  value={values.message}
                  onChange={(e) => patch({ message: e.target.value })}
                  placeholder="Your announcement message"
                />
              </FormCell>
              <div className="grid gap-3 max-md:contents sm:grid-cols-2">
                <FormCell label="Tablet (optional)" htmlFor="a-tablet">
                  <Input
                    id="a-tablet"
                    maxLength={160}
                    value={values.messageTablet}
                    onChange={(e) => patch({ messageTablet: e.target.value })}
                    placeholder="Uses the default message"
                  />
                </FormCell>
                <FormCell label="Desktop (optional)" htmlFor="a-desktop">
                  <Input
                    id="a-desktop"
                    maxLength={200}
                    value={values.messageDesktop}
                    onChange={(e) => patch({ messageDesktop: e.target.value })}
                    placeholder="Uses the tablet message"
                  />
                </FormCell>
              </div>
            </FormSection>
          </fieldset>

          <fieldset className={FIELDSET}>
            <legend className={LEGEND}>Button (optional)</legend>
            <FormSection>
              <div className="grid gap-3 max-md:contents sm:grid-cols-[1fr_1.5fr]">
                <FormCell label="Label" htmlFor="a-cta-label">
                  <Input
                    id="a-cta-label"
                    maxLength={30}
                    value={values.ctaLabel}
                    onChange={(e) => patch({ ctaLabel: e.target.value })}
                    placeholder="Button text"
                  />
                </FormCell>
                <FormCell label="Link" htmlFor="a-cta-url">
                  <Input
                    id="a-cta-url"
                    value={values.ctaUrl}
                    onChange={(e) => patch({ ctaUrl: e.target.value })}
                    placeholder="/page or https://…"
                    className="font-mono"
                  />
                </FormCell>
              </div>
            </FormSection>
          </fieldset>

          <fieldset className={cn(FIELDSET, 'space-y-2')}>
            <legend className={LEGEND}>Background colour</legend>
            <FormSection>
              <BackgroundPicker
                value={values.background}
                onChange={(background) => patch({ background })}
              />
            </FormSection>
          </fieldset>

          <fieldset className={FIELDSET}>
            <legend className={LEGEND}>Schedule ({zone})</legend>
            <FormSection>
              <div className="grid gap-3 max-md:contents sm:grid-cols-2">
                <FormCell label="Go live" htmlFor="a-start">
                  <DateTimePicker
                    id="a-start"
                    value={values.startsAt}
                    onChange={(startsAt) => patch({ startsAt })}
                    placeholder="As soon as enabled"
                  />
                </FormCell>
                <FormCell label="Expire" htmlFor="a-end">
                  <DateTimePicker
                    id="a-end"
                    value={values.endsAt}
                    onChange={(endsAt) => patch({ endsAt })}
                    placeholder="No expiry"
                    defaultTime="23:59"
                    minDate={values.startsAt}
                  />
                </FormCell>
              </div>
            </FormSection>
            {overlaps.length > 0 && (
              <div className="bg-warning/10 flex gap-2 rounded-lg px-3 py-2 text-xs max-md:mt-3">
                <TriangleAlertIcon
                  aria-hidden
                  className="text-warning-text mt-px size-3.5 shrink-0"
                />
                <p>
                  Overlaps with {overlaps.map((o) => o.title).join(', ')}. While both are live, the
                  one that went live most recently is shown.
                </p>
              </div>
            )}
          </fieldset>

          <FormSection>
            <FormCell
              label="Hide on pages"
              htmlFor="a-hide"
              info="One path per line. End with * to hide a whole section, like /section/*. Leave it empty to show everywhere."
            >
              <Textarea
                id="a-hide"
                rows={2}
                value={values.hidePaths}
                onChange={(e) => patch({ hidePaths: e.target.value })}
                placeholder="/page-path"
                className="text-ui font-mono"
              />
            </FormCell>
          </FormSection>
        </TabsContent>
        <TabsContent value="preview" keepMounted>
          <PhonePreview
            message={values.message}
            ctaLabel={values.ctaLabel}
            ctaUrl={values.ctaUrl}
            background={values.background}
          />
        </TabsContent>
      </Tabs>

      {footer(
        <SaveButton pending={pending} saved={feedback.showSaved}>
          {announcement ? 'Save' : 'Create announcement'}
        </SaveButton>
      )}
    </form>
  );
}

/**
 * The bar's colour and, beside it, the text colour the website will use on it. The picker offers
 * any colour; the website's four palette colours sit in its panel as saved swatches. The text is
 * chosen for the colour picked, so it is shown here rather than asked for.
 */
/**
 * The bar on a phone, as the website shows it, updating as the form changes. The screen scales
 * with the phone, so sizes are in cqw (a percentage of the screen's width), not px.
 */
function PhonePreview({
  message,
  ctaLabel,
  ctaUrl,
  background,
}: {
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  background: AnnouncementBackground;
}) {
  const { bg, fg } = announcementColours(background);
  return (
    <figure className="space-y-3 py-2">
      <Iphone className="mx-auto block w-full max-w-64">
        <div className="size-full bg-white text-neutral-900">
          {/* Clear of the status bar and the island. */}
          <div className="h-[19cqw]" />
          {/* The site's bar: centred, the button after the message, wrapping as it needs. */}
          <p
            className="flex flex-wrap items-center justify-center gap-x-[3.1cqw] gap-y-[1cqw] px-[6.2cqw] py-[2.6cqw] text-center text-[4.1cqw] leading-[1.5]"
            style={{ background: bg, color: fg }}
          >
            {message.trim() ? (
              <span>{message}</span>
            ) : (
              <span className="opacity-60">Your announcement message</span>
            )}
            {ctaLabel.trim() && ctaUrl.trim() && (
              <span className="font-medium underline underline-offset-4">{ctaLabel}</span>
            )}
          </p>
          {/* A stand-in for the page under the bar. */}
          <div className="space-y-[3cqw] p-[4cqw]">
            <div className="h-[28cqw] rounded-[3cqw] bg-neutral-100" />
            <div className="h-[3cqw] w-3/4 rounded-full bg-neutral-200" />
            <div className="h-[3cqw] w-1/2 rounded-full bg-neutral-200" />
          </div>
        </div>
      </Iphone>
      <figcaption className="text-muted-foreground text-center text-xs">
        The default message on a phone. The button shows once it has a label and a link.
      </figcaption>
    </figure>
  );
}

function BackgroundPicker({
  value,
  onChange,
}: {
  value: AnnouncementBackground;
  onChange: (value: AnnouncementBackground) => void;
}) {
  const { bg, fg } = announcementColours(value);
  const [swatches, setSwatches] = useState<ColorSwatch[]>(() =>
    palette.map((p) => ({ id: p.value, color: announcementColours(p.value).bg }))
  );
  return (
    <div className="space-y-2">
      <div className="grid items-start gap-3 md:grid-cols-2">
        <ColorPicker
          label="Bar colour"
          alpha={false}
          // A field-height trigger; its panel is wider and opens straight down from it.
          size="field"
          className="w-full"
          value={bg}
          onValueChange={(hex) => onChange(backgroundFromHex(hex))}
          // The readout compares the bar with the text that sits on it.
          background={fg}
          contrastLabel="with the bar's text"
          swatches={swatches}
          onSwatchesChange={setSwatches}
          maxSwatches={8}
        />
        <TextColourField background={value} />
      </div>
    </div>
  );
}

/** The text colour chosen for the bar, as a field the height of the picker's: shown, not edited. */
function TextColourField({ background }: { background: AnnouncementBackground }) {
  const { bg, fg } = announcementColours(background);
  const ratio = announcementContrast(background);
  const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'Low';
  return (
    <div
      role="group"
      title={`Contrast ${ratio.toFixed(1)} to 1`}
      aria-label={`Text colour, chosen automatically: ${fg}, contrast ${ratio.toFixed(1)} to 1, ${grade}`}
      className="bg-muted/60 touch:h-11 flex h-8 items-center gap-2 rounded-[10px] p-[3px] pr-2.5"
    >
      {/* The letters in the text colour on the bar's colour: what the bar will look like. */}
      <span
        aria-hidden
        className="ring-foreground/10 touch:size-9 flex size-6 shrink-0 items-center justify-center rounded-[7px] text-xs font-semibold ring-1"
        style={{ background: bg, color: fg }}
      >
        Aa
      </span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">Text</span>
      <span className="text-sm font-medium whitespace-nowrap uppercase tabular-nums">{fg}</span>
      <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">{grade}</span>
    </div>
  );
}
