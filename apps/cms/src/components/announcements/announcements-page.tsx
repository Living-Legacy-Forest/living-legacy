import {
  ANNOUNCEMENT_MOBILE_LENGTH,
  type AnnouncementBackground,
  type AnnouncementStatus,
  announcementClashes,
  announcementStatus,
} from '@ll/content';
import { useState } from 'react';
import { DateTimePicker } from '@/components/date-time-picker';
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
import {
  ConfirmBulkDelete,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/list/list-tools';
import { CopyIcon, MegaphoneIcon, PlusIcon, SendIcon, TriangleAlertIcon } from '@/components/icons';
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
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, zoneName } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { removedNotice } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import {
  type Announcement,
  type AnnouncementsData,
  deleteAnnouncements,
  saveAnnouncement,
} from '@/server/announcements';

const NOUN: [string, string] = ['announcement', 'announcements'];

/** The website's palette (apps/web global.css), with readable text on each. */
const backgrounds: { value: AnnouncementBackground; label: string; bg: string; fg: string }[] = [
  { value: 'moss', label: 'Moss (deep green)', bg: '#2c4633', fg: '#f6f2e9' },
  { value: 'ink', label: 'Ink (near black)', bg: '#17231c', fg: '#f6f2e9' },
  { value: 'sun', label: 'Sun (warm gold)', bg: '#d8c493', fg: '#17231c' },
  { value: 'paper', label: 'Paper (soft cream)', bg: '#ece5d6', fg: '#17231c' },
];

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

export function AnnouncementsPage({
  data,
  canWrite,
}: {
  data: AnnouncementsData;
  canWrite: boolean;
}) {
  const view = useListPane<Target>();
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const selection = useSelection(data.map((a) => a.id));
  const { run, pending } = useAction();

  const now = Date.now();
  const status = (a: Announcement) => announcementStatus(a, now);
  const clashes = announcementClashes(data, now);
  const sorted = [...data].sort(
    (a, b) =>
      statusOrder[status(a)] - statusOrder[status(b)] || (a.startsAt ?? 0) - (b.startsAt ?? 0)
  );
  const visible = sorted.filter((a) =>
    matchesSearch(query, [a.title, a.message, a.messageTablet, a.messageDesktop])
  );

  const editing = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((a) => a.id === target.id) ?? null) : null;
  // An announcement removed elsewhere closes the pane.
  const pane = view.pane?.kind === 'edit' && !editing(view.pane) ? null : view.pane;

  async function remove(ids: string[]) {
    const result = await run(() => deleteAnnouncements({ data: { ids } }), {
      success: removedNotice(ids.length, NOUN),
      error: 'Could not remove',
    });
    if (!result) return;
    if (view.pane?.kind === 'edit' && ids.includes(view.pane.id)) view.closePane();
    selection.clear();
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
      footer={footer}
    />
  );

  const newButton = (
    <Button size="sm" onClick={() => view.open({ kind: 'new' })}>
      <PlusIcon aria-hidden data-icon="inline-start" />
      New announcement
    </Button>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 data-slot="page-title" className="mr-auto text-xl">
          Announcements
        </h1>
        {data.length > 0 && (
          <SearchInput
            label="Search announcements"
            placeholder="Search names and messages"
            value={query}
            onChange={setQuery}
          />
        )}
        {canWrite && newButton}
      </div>

      {data.length === 0 && pane === null ? (
        <Empty className="flex-1 rounded-lg border">
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
        <ListPageLayout>
          <ListColumn
            label="Announcements"
            header={
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((a) => a.id)}
                title="All"
                total={data.length}
                pending={pending}
                onDelete={canWrite ? () => setToDelete(selection.checkedIds) : undefined}
              />
            }
          >
            {visible.length === 0 ? (
              <NoMatches onClear={() => setQuery('')}>
                No announcements match that search.
              </NoMatches>
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
                          ? { label: 'Delete', onAction: () => setToDelete([a.id]) }
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
                            <SendIcon aria-hidden data-icon="inline-start" />
                            Publish
                          </Button>
                        )
                      }
                      onOpen={() => canWrite && view.open({ kind: 'edit', id: a.id })}
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

          <PaneColumn label="Edit announcement">
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
                {pane.kind === 'edit' && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => view.setPane({ kind: 'new', from: editing(pane)! })}
                    >
                      <CopyIcon aria-hidden data-icon="inline-start" />
                      Duplicate for next time
                    </Button>
                  </div>
                )}
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

      <ConfirmBulkDelete
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        count={toDelete?.length ?? 0}
        noun={NOUN}
        description="They are deleted for good. Live ones disappear from the website."
        onConfirm={() => toDelete && remove(toDelete)}
      />

      {canWrite && (
        <ListDialog
          open={view.dialog !== null}
          onClose={view.closeDialog}
          size="lg"
          title={view.dialog?.kind === 'edit' ? 'Edit announcement' : 'New announcement'}
          description="A banner across the top of the website."
        >
          {view.dialog &&
            form(view.dialog, view.closeDialog, (submit) => (
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

function AnnouncementSummary({
  announcement: a,
  status,
  clashesWith,
}: {
  announcement: Announcement;
  status: AnnouncementStatus;
  clashesWith: Announcement[];
}) {
  const colour = backgrounds.find((b) => b.value === a.background)!;
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
            className="size-3.5 shrink-0 text-amber-600"
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
  footer,
}: {
  announcement: Announcement | null;
  /** Start from this one's content; dates are cleared and it starts switched off. */
  copyOf?: Announcement;
  others: Announcement[];
  onSaved: (id: string | null) => void;
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
    background: source?.background ?? ('moss' as AnnouncementBackground),
    startsAt: announcement?.startsAt ?? null,
    endsAt: announcement?.endsAt ?? null,
    hidePaths: (source?.hidePaths ?? []).join('\n'),
  });
  const { run, pending } = useAction();
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
        success: {
          title: announcement ? 'Announcement saved' : 'Announcement created',
          description: 'It shows on the website while it is on and within its dates.',
        },
        error: 'Could not save the announcement',
      }
    );
    if (result) onSaved(result.id);
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="a-title">Name</Label>
        <Input
          id="a-title"
          required
          maxLength={80}
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="e.g. Monthly promotion"
        />
        <p className="text-muted-foreground text-xs">
          For the CMS list only. Not shown on the site.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="a-enabled">Enabled</Label>
          <p className="text-muted-foreground text-xs">
            Off hides it, whatever the dates. Shows within its dates when on.
          </p>
        </div>
        <Switch
          id="a-enabled"
          checked={values.enabled}
          onCheckedChange={(enabled) => patch({ enabled })}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Message</legend>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="a-message">Default (phones)</Label>
            <span
              className={cn(
                'text-muted-foreground text-xs tabular-nums',
                values.message.length > ANNOUNCEMENT_MOBILE_LENGTH && 'text-amber-600'
              )}
            >
              {values.message.length}/{ANNOUNCEMENT_MOBILE_LENGTH}
            </span>
          </div>
          <Input
            id="a-message"
            required
            maxLength={160}
            value={values.message}
            onChange={(e) => patch({ message: e.target.value })}
            placeholder="Your announcement message"
          />
          <p className="text-muted-foreground text-xs">
            Keep under {ANNOUNCEMENT_MOBILE_LENGTH} characters to stay on one line on a phone. Used
            on larger screens too, unless replaced below.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="a-tablet">Tablet (optional)</Label>
            <Input
              id="a-tablet"
              maxLength={160}
              value={values.messageTablet}
              onChange={(e) => patch({ messageTablet: e.target.value })}
              placeholder="Uses the default message"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-desktop">Desktop (optional)</Label>
            <Input
              id="a-desktop"
              maxLength={200}
              value={values.messageDesktop}
              onChange={(e) => patch({ messageDesktop: e.target.value })}
              placeholder="Uses the tablet message"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Button (optional)</legend>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr]">
          <div className="space-y-1.5">
            <Label htmlFor="a-cta-label">Label</Label>
            <Input
              id="a-cta-label"
              maxLength={30}
              value={values.ctaLabel}
              onChange={(e) => patch({ ctaLabel: e.target.value })}
              placeholder="Button text"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-cta-url">Link</Label>
            <Input
              id="a-cta-url"
              value={values.ctaUrl}
              onChange={(e) => patch({ ctaUrl: e.target.value })}
              placeholder="/page or https://…"
              className="font-mono"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Background colour</legend>
        <div className="grid grid-cols-2 gap-2">
          {backgrounds.map((b) => (
            <label
              key={b.value}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                values.background === b.value
                  ? 'border-ring ring-ring/30 ring-2'
                  : 'hover:bg-muted/60'
              )}
            >
              <input
                type="radio"
                name="a-background"
                value={b.value}
                checked={values.background === b.value}
                onChange={() => patch({ background: b.value })}
                className="sr-only"
              />
              <span
                aria-hidden
                className="ring-border size-4 shrink-0 rounded-full ring-1"
                style={{ background: b.bg }}
              />
              {b.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Schedule ({zone})</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="a-start">Go live</Label>
            <DateTimePicker
              id="a-start"
              value={values.startsAt}
              onChange={(startsAt) => patch({ startsAt })}
              placeholder="As soon as enabled"
            />
            <p className="text-muted-foreground text-xs">
              Blank shows it as soon as it is enabled.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-end">Expire</Label>
            <DateTimePicker
              id="a-end"
              value={values.endsAt}
              onChange={(endsAt) => patch({ endsAt })}
              placeholder="No expiry"
              defaultTime="23:59"
              minDate={values.startsAt}
            />
            <p className="text-muted-foreground text-xs">Blank never expires.</p>
          </div>
        </div>
        {overlaps.length > 0 && (
          <p className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <TriangleAlertIcon aria-hidden className="mt-px size-3.5 shrink-0 text-amber-600" />
            <span>
              Overlaps with {overlaps.map((o) => o.title).join(', ')}. While both are live, the one
              that went live most recently is shown.
            </span>
          </p>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="a-hide">Hide on pages</Label>
        <Textarea
          id="a-hide"
          rows={2}
          value={values.hidePaths}
          onChange={(e) => patch({ hidePaths: e.target.value })}
          placeholder="/page-path"
          className="text-ui font-mono"
        />
        <p className="text-muted-foreground text-xs">
          One path per line. End with * to hide a whole section, like /section/*. Leave empty to
          show everywhere.
        </p>
      </div>

      {footer(
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : announcement ? (
            'Save'
          ) : (
            'Create announcement'
          )}
        </Button>
      )}
    </form>
  );
}
