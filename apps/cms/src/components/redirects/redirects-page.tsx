import { checkRedirect } from '@ll/content';
import { BulkCsvForm } from '@/components/bulk/bulk-csv-form';
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
  useListPane,
} from '@/components/list/list-page';
import { ListRow } from '@/components/list/list-row';
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
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from '@/components/icons';
import { useEffect, useState } from 'react';
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
import { Spinner } from '@/components/ui/spinner';
import { readYesNo } from '@/lib/bulk-import';
import { reportInvalid } from '@/lib/form-validation';
import { notify, removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/utils';
import {
  type Redirect,
  type RedirectsData,
  deleteRedirect,
  deleteRedirects,
  importRedirects,
  saveRedirect,
} from '@/server/redirects';

type Code = '301' | '302' | '410';

const codeItems: { value: Code; label: string }[] = [
  { value: '301', label: '301 - Permanent' },
  { value: '302', label: '302 - Temporary' },
  { value: '410', label: '410 - Removed, no replacement' },
];

const dateFormat = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' });

function usage(r: Redirect) {
  if (r.hits === 0) return 'Not used yet';
  const times = `Used ${r.hits} ${r.hits === 1 ? 'time' : 'times'}`;
  return r.lastHitAt ? `${times}, last on ${dateFormat.format(r.lastHitAt)}` : times;
}

type Filter = 'all' | '301' | '302' | '410' | 'off' | 'unused';

const filterItems: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: '301', label: '301 - Permanent' },
  { value: '302', label: '302 - Temporary' },
  { value: '410', label: '410 - Removed' },
  { value: 'off', label: 'Turned off' },
  { value: 'unused', label: 'Never used' },
];

function matchesFilter(r: Redirect, filter: Filter) {
  if (filter === 'off') return !r.enabled;
  if (filter === 'unused') return r.hits === 0;
  return filter === 'all' || String(r.statusCode) === filter;
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

export function RedirectsPage({
  data,
  initialFrom,
  onOpenedInitial,
}: {
  data: RedirectsData;
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
  const [filter, setFilter] = useState<Filter>('all');
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((r) => r.id));
  const { run, pending } = useAction();

  const redirectFor = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((r) => r.id === target.id) ?? null) : null;
  // A redirect removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !redirectFor(view.pane) ? null : view.pane;
  const visible = data.filter(
    (r) => matchesFilter(r, filter) && matchesSearch(query, [r.fromPath, r.toPath, r.note])
  );

  async function remove(ids: string[]) {
    const result = await run(() => deleteRedirects({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
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
      footer={(formPending, isNew) =>
        actions(<SubmitButton pending={formPending} isNew={isNew} />, formPending)
      }
    />
  );

  const addButtons = (
    <>
      <Button size="sm" variant="outline" onClick={() => view.open({ kind: 'bulk' })}>
        <UploadIcon aria-hidden data-icon="inline-start" />
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
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Redirects
        </h1>
        {data.length > 0 && (
          <>
            <SearchInput
              label="Search redirects"
              placeholder="Search paths and notes"
              value={query}
              onChange={setQuery}
            />
            <Select
              items={filterItems}
              value={filter}
              onValueChange={(value) => value && setFilter(value as Filter)}
            >
              <SelectTrigger
                aria-label="Filter redirects"
                size="sm"
                className="bg-muted/60 text-ui w-40 border-0 shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="text-ui">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <div className="flex gap-3 max-md:hidden">{addButtons}</div>
        <PageActions
          edit={{
            editing: selection.selecting,
            onToggle: selection.selecting ? selection.clear : selection.startEditing,
          }}
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
        <ListPageLayout>
          <ListColumn
            label="Redirects"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((r) => r.id)}
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
                  setFilter('all');
                }}
              >
                No redirects match.
              </NoMatches>
            ) : (
              <ListRows>
                {visible.map((r) => (
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
                    menu={redirectMenu(r)}
                    onOpen={() => view.open({ kind: 'edit', id: r.id })}
                  >
                    <RedirectSummary redirect={r} />
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListColumn>

          <PaneColumn label="Edit redirect">
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
                    <DeleteRedirect redirect={paneRedirect} onRemoved={view.closePane} />
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
          ? bulkForm(view.closeDialog, (submit) => <DialogActions>{submit}</DialogActions>)
          : view.dialog &&
            redirectForm(view.dialog, view.closeDialog, (submit, formPending) => (
              <DialogActions
                start={
                  dialogRedirect && (
                    <DeleteRedirect
                      redirect={dialogRedirect}
                      disabled={formPending}
                      onRemoved={view.closeDialog}
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

function RedirectSummary({ redirect }: { redirect: Redirect }) {
  return (
    <span className={cn('block', !redirect.enabled && 'opacity-60')}>
      <span className="flex items-center gap-2">
        <span className="text-ui min-w-0 flex-1 truncate font-mono">{redirect.fromPath}</span>
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
          {redirect.hits} {redirect.hits === 1 ? 'hit' : 'hits'}
        </span>
      </span>
    </span>
  );
}

function SubmitButton({ pending, isNew }: { pending: boolean; isNew: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Spinner />
          Saving…
        </>
      ) : isNew ? (
        'Add redirect'
      ) : (
        'Save'
      )}
    </Button>
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
  footer,
}: {
  redirect: Redirect | null;
  /** The old path for a new redirect, when one was passed in. */
  initialFrom?: string;
  onSaved: (id: string) => void;
  footer: (pending: boolean, isNew: boolean) => React.ReactNode;
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
            statusCode: Number(statusCode) as 301 | 302 | 410,
            enabled,
            keepQuery,
            note: note || undefined,
          },
        }),
      {
        success: {
          title: redirect ? 'Redirect saved' : 'Redirect added',
          description: enabled
            ? 'It is on, so the website uses it.'
            : 'It is off, so the website ignores it.',
        },
        error: 'Could not save the redirect',
      }
    );
    if (!result) return;
    for (const warning of result.warnings) {
      notify.warning({ title: 'Check this redirect', description: warning });
    }
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
      {footer(pending, redirect === null)}
    </form>
  );
}
