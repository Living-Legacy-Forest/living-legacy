import { type RedirectStatusCode, checkRedirect } from '@ll/content';
import { BulkCsvForm } from '@/components/bulk/bulk-csv-form';
import { FormCell, FormSection, FormSwitchCell } from '@/components/form-cells';
import { PageActions } from '@/components/shell/page-actions';
import {
  DialogActions,
  ListColumn,
  ListDialog,
  ListPageLayout,
  ListPager,
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
import { usePaged } from '@/lib/use-paged';
import { copyLink, openInNewTab, siteUrl } from '@/lib/site';
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  LinkIcon,
  PanelRightIcon,
  PlusIcon,
  ToggleOffIcon,
  ToggleOnIcon,
  Trash2Icon,
} from '@/components/icons';
import { useEffect, useState } from 'react';
import { CardMeta, ListCard, ListCards } from '@/components/list/list-card';
import { ListFilter, passes } from '@/components/list/list-filter';
import { ListSort, byNumber, byText, sortedBy, useListSort } from '@/components/list/list-sort';
import { TrendChart } from '@/components/list/trend-chart';
import { readPaneOpen } from '@/lib/list-view';
import { ViewSwitch, useListView } from '@/components/list/view-switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { readYesNo } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { notify, removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { cn } from '@/lib/utils';
import {
  type Redirect,
  type RedirectsData,
  deleteRedirect,
  deleteRedirects,
  importRedirects,
  saveRedirect,
  setRedirectEnabled,
} from '@/server/redirects';
import { sameDate } from '@/lib/format';

type Code = '301' | '302' | '307' | '308' | '410';

const codeItems: { value: Code; label: string }[] = [
  { value: '301', label: '301 - Permanent' },
  { value: '302', label: '302 - Temporary' },
  { value: '308', label: '308 - Permanent, keeps form posts' },
  { value: '307', label: '307 - Temporary, keeps form posts' },
  { value: '410', label: '410 - Removed, no replacement' },
];

const dateFormat = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' });

function usage(r: Redirect) {
  if (r.hits === 0) return 'Not used yet';
  const times = `Used ${r.hits} ${r.hits === 1 ? 'time' : 'times'}`;
  return r.lastHitAt ? `${times}, last on ${sameDate(dateFormat.format(r.lastHitAt))}` : times;
}

const filterGroups = [
  {
    key: 'types',
    label: 'Type',
    options: [
      { value: '301', label: '301 - Permanent' },
      { value: '302', label: '302 - Temporary' },
      { value: '308', label: '308 - Permanent' },
      { value: '307', label: '307 - Temporary' },
      { value: '410', label: '410 - Removed' },
    ],
  },
  {
    key: 'states',
    label: 'State',
    options: [
      { value: 'on', label: 'Turned on' },
      { value: 'off', label: 'Turned off' },
    ],
  },
  {
    key: 'usage',
    label: 'Use',
    options: [
      { value: 'used', label: 'Used' },
      { value: 'unused', label: 'Never used' },
    ],
  },
];

function matchesFilters(r: Redirect, picked: Record<string, string[]>) {
  return (
    passes(picked.types, String(r.statusCode)) &&
    passes(picked.states, r.enabled ? 'on' : 'off') &&
    passes(picked.usage, r.hits > 0 ? 'used' : 'unused')
  );
}

const NOUN: [string, string] = ['redirect', 'redirects'];

/** A CSV row's values as redirect fields, or what is wrong with them. */
function redirectFromCsv(values: Record<string, string>) {
  const statusCode = Number(values.type || 301);
  const problem = checkRedirect(values.from ?? '', values.to ?? '', statusCode);
  if (problem) return problem;
  // Blank means yes for these two, matching the form's defaults.
  const enabled = values.active ? readYesNo(values.active) : true;
  const keepQuery = values.keep_query ? readYesNo(values.keep_query) : true;
  if (enabled === null) return 'Active must be yes or no.';
  if (keepQuery === null) return 'Keep query must be yes or no.';
  if ((values.note ?? '').length > 200) return 'The note is over 200 characters.';
  return {
    fromPath: values.from!,
    toPath: statusCode === 410 ? '' : values.to!,
    statusCode,
    note: values.note,
    enabled,
    keepQuery,
  };
}

/** What the pane (or, on smaller screens, the dialog) shows. */
type Target =
  | { kind: 'edit'; id: string }
  /** `fromPath` fills in the old path, from a link on Missing pages. */
  | { kind: 'new'; fromPath?: string }
  | { kind: 'bulk' };

/** A path ending in * stands for many pages, so there is no one link to test or copy. */
function redirectMenu(r: Redirect) {
  if (r.fromPath.endsWith('*')) return undefined;
  const url = siteUrl(r.fromPath);
  return [
    ...(r.enabled
      ? [
          {
            label: 'Test redirect',
            icon: <ExternalLinkIcon aria-hidden />,
            onSelect: () => openInNewTab(url),
            shortcut: { key: 't' },
          },
        ]
      : []),
    {
      label: 'Copy old link',
      icon: <LinkIcon aria-hidden />,
      onSelect: () => void copyLink(url),
      shortcut: { key: 'c' },
    },
  ];
}

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'from-az', label: 'From path, A to Z' },
  { value: 'from-za', label: 'From path, Z to A' },
  { value: 'to-az', label: 'Sends to, A to Z' },
  { value: 'clicks', label: 'Most clicks' },
  { value: 'recent', label: 'Recently clicked' },
] as const;

export function RedirectsPage({
  data,
  initialFrom,
  onOpenedInitial,
  switcher,
}: {
  data: RedirectsData;
  /** Switches to Missing pages, which shares this page. */
  switcher?: React.ReactNode;
  /** An old path to start a new redirect for, from ?from= in the address. */
  initialFrom?: string;
  /** Clears ?from= once used, so going back does not open the form again. */
  onOpenedInitial?: () => void;
}) {
  const view = useListPane<Target>();
  useEffect(() => {
    if (!initialFrom) return;
    view.open({ kind: 'new', fromPath: initialFrom });
    onOpenedInitial?.();
    // Only on arrival with ?from=, not on every render that has it.
  }, [initialFrom]);
  const [query, setQuery] = useState('');
  // Ticked values per filter group; an empty group does not narrow the list.
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  // The edit pane can fold away to give the list the full width; the choice is remembered.
  const [layout, setLayout] = useListView('redirects');
  // Cards take the full width, so Grid starts with the editor folded away.
  const [paneOpen, setPaneOpenState] = useState(
    () => readPaneOpen('redirects') && layout !== 'grid'
  );
  // Choosing a redirect or adding one brings the editor back.
  useEffect(() => {
    if (view.pane) setPaneOpenState(true);
  }, [view.pane]);
  const setPaneOpen = (open: boolean) => {
    setPaneOpenState(open);
    document.cookie = `redirects_pane=${open ? 'open' : 'closed'}; path=/; max-age=31536000; samesite=lax`;
  };
  const grid = layout === 'grid';
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((r) => r.id));
  const { run, pending } = useAction();
  const revealing = useRevealOnce();

  const redirectFor = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((r) => r.id === target.id) ?? null) : null;
  // A redirect removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !redirectFor(view.pane) ? null : view.pane;
  const [sort, setSort] = useListSort(SORTS);
  const ordered = sortedBy(data, sort, {
    oldest: (a, b) => byNumber(a.createdAt, b.createdAt),
    'from-az': (a, b) => byText(a.fromPath, b.fromPath),
    'from-za': (a, b) => byText(b.fromPath, a.fromPath),
    'to-az': (a, b) => byText(a.toPath, b.toPath),
    clicks: (a, b) => byNumber(b.hits, a.hits),
    recent: (a, b) => byNumber(b.lastHitAt, a.lastHitAt),
  });
  const visible = ordered.filter(
    (r) => matchesFilters(r, picked) && matchesSearch(query, [r.fromPath, r.toPath, r.note])
  );
  // A new search, filter or order starts again from the first page.
  const paged = usePaged(visible, JSON.stringify([query, picked, sort]));
  const clearFilters = () => {
    setPicked({});
    selection.clear();
  };

  const rowMenu = (r: Redirect): RowMenuItem[] => [
    ...(redirectMenu(r) ?? []),
    {
      label: r.enabled ? 'Turn off' : 'Turn on',
      icon: r.enabled ? <ToggleOffIcon aria-hidden /> : <ToggleOnIcon aria-hidden />,
      destructive: r.enabled,
      shortcut: { key: 'o' },
      onSelect: () =>
        void run(() => setRedirectEnabled({ data: { id: r.id, enabled: !r.enabled } }), {
          success: r.enabled
            ? { title: 'Redirect turned off', description: `${r.fromPath} no longer redirects.` }
            : { title: 'Redirect turned on', description: `${r.fromPath} redirects again.` },
          error: 'Could not change it',
        }),
    },
  ];

  async function remove(ids: string[]) {
    const result = await run(() => deleteRedirects({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    view.closeIfShowing((t) => t.kind === 'edit' && ids.includes(t.id));
    selection.clear();
  }

  const bulkForm = (onDone: () => void, actions: (submit: React.ReactNode) => React.ReactNode) => (
    <BulkCsvForm
      noun={NOUN}
      fileName="redirects"
      fields={['from', 'to', 'type', 'note', 'active', 'keep_query']}
      example={{
        from: '/old-page',
        to: '/new-page',
        type: '301',
        note: 'Why this exists',
        active: 'yes',
        keep_query: 'yes',
      }}
      current={data.map((r) => ({
        id: r.id,
        from: r.fromPath,
        to: r.toPath,
        type: String(r.statusCode),
        note: r.note ?? '',
        active: r.enabled ? 'yes' : 'no',
        keep_query: r.keepQuery ? 'yes' : 'no',
      }))}
      toRow={redirectFromCsv}
      apply={(rows) => importRedirects({ data: { rows } })}
      onDone={onDone}
      footer={actions}
    />
  );

  /** Matches the pane or dialog while it edits this redirect. */
  const showing = (id: string) => (t: Target) => t.kind === 'edit' && t.id === id;

  const redirectForm = (
    target: Target,
    onSaved: (id: string) => void,
    actions: (submit: React.ReactNode, formPending: boolean) => React.ReactNode
  ) => (
    <RedirectForm
      key={target.kind === 'edit' ? target.id : target.kind}
      redirect={redirectFor(target)}
      initialFrom={target.kind === 'new' ? target.fromPath : undefined}
      onSaved={onSaved}
      onDirtyChange={view.reportDirty}
      footer={(formPending, isNew, saved) =>
        actions(
          <SaveButton pending={formPending} saved={saved}>
            {isNew ? 'Add redirect' : 'Save'}
          </SaveButton>,
          formPending
        )
      }
    />
  );

  const addButtons = (
    <>
      <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'bulk' })}>
        Bulk update
      </Button>
      <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
        <PlusIcon aria-hidden data-icon="inline-start" />
        Add redirect
      </Button>
    </>
  );

  const paneRedirect = redirectFor(pane);
  const dialogRedirect = redirectFor(view.dialog);

  return (
    <div
      data-slot="list-page"
      data-revealing={revealing || undefined}
      className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none"
    >
      <div data-slot="list-toolbar" className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex flex-wrap items-center gap-3 max-md:w-full">
          <h1 data-slot="page-title" className="text-xl">
            Redirects
          </h1>
          {switcher}
        </div>
        {data.length > 0 && (
          <>
            <SearchInput
              label="Search redirects"
              placeholder="Search paths and notes"
              value={query}
              onChange={setQuery}
            />
            <ListSort options={SORTS} value={sort} onChange={setSort} />
            <ListFilter
              groups={filterGroups}
              values={picked}
              onChange={(key, next) => {
                setPicked((prev) => ({ ...prev, [key]: next }));
                selection.clear();
              }}
              onClear={clearFilters}
            />
            <ViewSwitch
              value={layout}
              onChange={(next) => {
                setLayout(next);
                // Cards take the full width, as on Posts; the list brings the editor back.
                setPaneOpenState(next === 'list');
                selection.clear();
              }}
            />
          </>
        )}
        {data.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={paneOpen ? 'Expand list' : 'Show editor'}
            aria-pressed={!paneOpen}
            title={paneOpen ? 'Expand list' : 'Show editor'}
            className="max-lg:hidden"
            onClick={() => setPaneOpen(!paneOpen)}
          >
            <PanelRightIcon aria-hidden />
          </Button>
        )}
        <div className="flex gap-3 max-md:hidden">{addButtons}</div>
        <PageActions
          edit={
            grid
              ? undefined
              : {
                  editing: selection.selecting,
                  onToggle: selection.selecting ? selection.clear : selection.startEditing,
                }
          }
          add={{ label: 'Add redirect', onClick: () => view.open({ kind: 'new' }) }}
          more={[{ label: 'Bulk update', onClick: () => view.open({ kind: 'bulk' }) }]}
        />
      </div>

      {data.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArrowRightIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No redirects yet</EmptyTitle>
            <EmptyDescription>Add one to point an old path at its new home.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">{addButtons}</div>
          </EmptyContent>
        </Empty>
      ) : (
        <ListPageLayout
          // The list gets the larger share to start with (the edit form is only about 450px wide),
          // and the divider lets people change it. Folded away, the list takes the whole width.
          resizable={{ key: 'redirects', defaultShare: 0.6, active: paneOpen, animated: true }}
          className={cn(
            'motion-reduce:transition-none lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]',
            !paneOpen && 'lg:grid-cols-[1fr_0fr]'
          )}
        >
          <ListColumn
            className={cn(
              'transition-[border-color] duration-300 lg:min-w-80',
              !paneOpen && 'border-transparent'
            )}
            label="Redirects"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((r) => r.id)}
                pageIds={paged.shown.map((r) => r.id)}
                title="All"
                total={data.length}
                pending={pending}
                onDelete={() => setToDelete(selection.checkedIds)}
              />
            }
          >
            {visible.length === 0 ? (
              <NoMatches
                clearLabel="Clear search and filter"
                onClear={() => {
                  setQuery('');
                  clearFilters();
                }}
              >
                No redirects match.
              </NoMatches>
            ) : grid ? (
              <ListCards>
                {paged.shown.map((r) => (
                  <ListCard
                    key={r.id}
                    title={r.fromPath}
                    current={pane?.kind === 'edit' && pane.id === r.id}
                    menu={rowMenu(r)}
                    remove={{ label: 'Delete', onAction: () => setToDelete([r.id]) }}
                    onOpen={() => view.open({ kind: 'edit', id: r.id })}
                  >
                    <RedirectCardBody redirect={r} />
                  </ListCard>
                ))}
              </ListCards>
            ) : (
              <ListRows>
                {paged.shown.map((r) => (
                  <ListRow
                    key={r.id}
                    align="start"
                    current={pane?.kind === 'edit' && pane.id === r.id}
                    select={{
                      label: `Select ${r.fromPath}`,
                      checked: selection.isChecked(r.id),
                      selecting: selection.selecting,
                      onToggle: () => selection.toggle(r.id),
                    }}
                    swipe={{ label: 'Delete', onAction: () => setToDelete([r.id]) }}
                    menu={rowMenu(r)}
                    onOpen={() => {
                      // As on Posts: the open row closes the editor, any other row opens it.
                      if (isDesktop() && paneOpen && pane?.kind === 'edit' && pane.id === r.id) {
                        return setPaneOpen(false);
                      }
                      setPaneOpen(true);
                      view.open({ kind: 'edit', id: r.id });
                    }}
                  >
                    <RedirectSummary redirect={r} wide={!paneOpen} />
                  </ListRow>
                ))}
              </ListRows>
            )}
            {paged.needed && (
              <ListPager
                {...paged.pager}
                noun="redirects"
                label="Redirect pages"
                className="mt-0 shrink-0 border-t px-3 py-2 max-md:border-0"
              />
            )}
          </ListColumn>

          <PaneColumn
            label="Edit redirect"
            inert={!paneOpen}
            className={cn(
              'min-w-0 overflow-hidden transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              !paneOpen && 'translate-x-4 opacity-0'
            )}
          >
            {pane === null ? (
              <PaneEmpty
                title="No redirect selected"
                description="Choose one from the list, or add a new redirect."
              />
            ) : pane.kind === 'bulk' ? (
              <PaneFrame title="Bulk update redirects" width="lg">
                {bulkForm(view.closePane, (submit) => (
                  <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                ))}
              </PaneFrame>
            ) : (
              <PaneFrame
                title={
                  paneRedirect ? (
                    <span className="font-mono">{paneRedirect.fromPath}</span>
                  ) : (
                    'New redirect'
                  )
                }
                actions={
                  paneRedirect && (
                    <DeleteRedirect
                      redirect={paneRedirect}
                      onRemoved={() => view.closeIfShowing(showing(paneRedirect.id))}
                    />
                  )
                }
              >
                {redirectForm(
                  pane,
                  (id) => view.setPane({ kind: 'edit', id }),
                  (submit) => (
                    <PaneActions onCancel={view.closePane}>{submit}</PaneActions>
                  )
                )}
              </PaneFrame>
            )}
          </PaneColumn>
        </ListPageLayout>
      )}

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="Those old paths will no longer redirect. This cannot be undone."
        onConfirm={() => toDelete && remove(toDelete)}
      />

      <LeaveDialog blocker={view.leave} what="redirect" />

      <ListDialog
        open={view.dialog !== null}
        onClose={view.closeDialog}
        size={view.dialog?.kind === 'bulk' ? 'lg' : 'md'}
        title={
          view.dialog?.kind === 'bulk'
            ? 'Bulk update redirects'
            : view.dialog?.kind === 'new'
              ? 'Add redirect'
              : 'Edit redirect'
        }
        description={
          view.dialog?.kind === 'bulk'
            ? 'Add or update many redirects at once from a CSV file.'
            : 'Send one URL to another.'
        }
      >
        {view.dialog?.kind === 'bulk'
          ? bulkForm(view.dismissDialog, (submit) => <DialogActions>{submit}</DialogActions>)
          : view.dialog &&
            redirectForm(view.dialog, view.dismissDialog, (submit, formPending) => (
              <DialogActions
                start={
                  dialogRedirect && (
                    <DeleteRedirect
                      redirect={dialogRedirect}
                      disabled={formPending}
                      onRemoved={() => view.closeIfShowing(showing(dialogRedirect.id))}
                    />
                  )
                }
              >
                {submit}
              </DialogActions>
            ))}
      </ListDialog>
    </div>
  );
}

/** Under a card's title: type or Off, where it goes, and how often it has been used. */
function RedirectCardBody({ redirect }: { redirect: Redirect }) {
  return (
    <>
      <span className="flex items-center gap-2">
        {redirect.enabled ? (
          <Badge variant={redirect.statusCode === 301 ? 'secondary' : 'outline'}>
            {redirect.statusCode}
          </Badge>
        ) : (
          <Badge variant="outline">Off</Badge>
        )}
      </span>
      <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
        {redirect.statusCode === 410 ? (
          'Removed'
        ) : (
          <>
            <ArrowRightIcon aria-hidden className="size-3 shrink-0" />
            <span className="min-w-0 truncate font-mono">{redirect.toPath}</span>
          </>
        )}
      </span>
      <CardMeta>{usage(redirect)}</CardMeta>
      <TrendChart series={redirect.trend} label="Clicks" className="mt-1 h-10 w-full" />
    </>
  );
}

/** `wide` is the list at full width: the chart then shows its 30-day total, as Posts does. */
function RedirectSummary({ redirect, wide }: { redirect: Redirect; wide: boolean }) {
  return (
    <span className={cn('block', !redirect.enabled && 'opacity-60')}>
      <span className="flex items-center gap-2">
        <span className="text-ui min-w-0 flex-1 truncate font-mono">{redirect.fromPath}</span>
        <span className="flex shrink-0 max-sm:hidden">
          <TrendChart series={redirect.trend} label="Clicks" showTotal={wide} />
        </span>
        {redirect.enabled ? (
          <Badge variant={redirect.statusCode === 301 ? 'secondary' : 'outline'}>
            {redirect.statusCode}
          </Badge>
        ) : (
          <Badge variant="outline">Off</Badge>
        )}
      </span>
      <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
        {redirect.statusCode === 410 ? (
          <span className="min-w-0 flex-1 truncate">Removed</span>
        ) : (
          <>
            <ArrowRightIcon aria-hidden className="size-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono">{redirect.toPath}</span>
          </>
        )}
        <span className="shrink-0 tabular-nums">
          {redirect.hits} {redirect.hits === 1 ? 'click' : 'clicks'}
        </span>
      </span>
    </span>
  );
}

function DeleteRedirect({
  redirect,
  disabled,
  onRemoved,
}: {
  redirect: Redirect;
  disabled?: boolean;
  onRemoved: () => void;
}) {
  const { run, pending } = useAction();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || pending}
            aria-label={`Remove redirect from ${redirect.fromPath}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this redirect?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono">{redirect.fromPath}</span> will no longer redirect. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              run(
                async () => {
                  await deleteRedirect({ data: { id: redirect.id } });
                  return true;
                },
                {
                  success: removedNotice(1, NOUN),
                  error: 'Could not remove the redirect',
                }
              ).then((removed) => removed && onRemoved())
            }
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shared fields + submit logic, used inline (desktop pane) and in the mobile dialog. */
function RedirectForm({
  redirect,
  initialFrom,
  onSaved,
  onDirtyChange,
  footer,
}: {
  redirect: Redirect | null;
  /** The old path for a new redirect, when one was passed in. */
  initialFrom?: string;
  onSaved: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  footer: (pending: boolean, isNew: boolean, saved: boolean) => React.ReactNode;
}) {
  const [fromPath, setFromPath] = useState(redirect?.fromPath ?? initialFrom ?? '');
  const [toPath, setToPath] = useState(redirect?.toPath ?? '');
  const [statusCode, setStatusCode] = useState<Code>(
    redirect ? (String(redirect.statusCode) as Code) : '301'
  );
  const [keepQuery, setKeepQuery] = useState(redirect?.keepQuery ?? true);
  const [enabled, setEnabled] = useState(redirect?.enabled ?? true);
  const [note, setNote] = useState(redirect?.note ?? '');
  const { run, pending } = useAction();
  const form = useFormDirty(
    [fromPath, toPath, statusCode, keepQuery, enabled, note],
    onDirtyChange
  );
  const feedback = useSaveFeedback({ editing: redirect !== null, dirty: form.dirty });
  const removed = statusCode === '410';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(
      () =>
        saveRedirect({
          data: {
            id: redirect?.id,
            fromPath,
            toPath: removed ? '' : toPath,
            statusCode: Number(statusCode) as RedirectStatusCode,
            enabled,
            keepQuery,
            note: note || undefined,
          },
        }),
      {
        success: feedback.toast({
          title: redirect ? 'Redirect saved' : 'Redirect added',
          description: enabled
            ? 'It is on, so the website uses it.'
            : 'It is off, so the website ignores it.',
        }),
        error: 'Could not save the redirect',
      }
    );
    if (!result) return;
    // About the redirect, not the form, so they show even if the form has gone.
    for (const warning of result.warnings) {
      notify.warning({ title: 'Check this redirect', description: warning });
    }
    // A form closed, replaced or edited again while it saved stays as it is now.
    if (!form.markSaved(redirect === null)) return;
    feedback.saved();
    onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 max-md:space-y-7">
      <FormSection>
        <FormCell
          label="Old path"
          htmlFor="r-from"
          hint="End with * to cover everything under a path, like /blog/*."
        >
          <Input
            id="r-from"
            required
            value={fromPath}
            onChange={(e) => setFromPath(e.target.value)}
            placeholder="/old-page"
            className="font-mono"
          />
        </FormCell>
        <FormCell
          label="Type"
          htmlFor="r-type"
          hint={
            removed
              ? 'Visitors see the not-found page, and search engines drop the page sooner.'
              : undefined
          }
        >
          <Select
            items={codeItems}
            value={statusCode}
            onValueChange={(value) => value && setStatusCode(value as Code)}
          >
            <SelectTrigger id="r-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {codeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormCell>
        {!removed && (
          <FormCell
            label="Destination"
            htmlFor="r-to"
            hint="A path like /new-page or a full URL. A * here receives what the old path's * matched."
          >
            <Input
              id="r-to"
              required
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder="/new-page"
              className="font-mono"
            />
          </FormCell>
        )}
        <FormCell label="Note" htmlFor="r-note">
          <Input
            id="r-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this exists (optional)"
          />
        </FormCell>
      </FormSection>
      <FormSection>
        {!removed && (
          <FormSwitchCell
            id="r-keep-query"
            label="Keep query string"
            description="Carry tracking tags like ?utm_source= over to the destination."
            checked={keepQuery}
            onCheckedChange={setKeepQuery}
          />
        )}
        <FormSwitchCell
          id="r-enabled"
          label="Active"
          description="Turn off to pause this redirect without deleting it."
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </FormSection>
      {redirect && <p className="text-muted-foreground text-xs">{usage(redirect)}.</p>}
      {footer(pending, redirect === null, feedback.showSaved)}
    </form>
  );
}
