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
  BulkPane,
  ConfirmBulkDelete,
  RowCheckbox,
  SearchInput,
  SelectionBar,
  matchesSearch,
  useSelection,
} from '@/components/bulk/list-tools';
import {
  CopyIcon,
  MegaphoneIcon,
  PanelRightIcon,
  PlusIcon,
  SendIcon,
  TriangleAlertIcon,
} from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/** What the pane edits: a saved announcement, or a new one (maybe copied). */
type Target = { kind: 'edit'; id: string } | { kind: 'new'; from?: Announcement };

export function AnnouncementsPage({
  data,
  canWrite,
}: {
  data: AnnouncementsData;
  canWrite: boolean;
}) {
  const [paneTarget, setPaneTarget] = useState<Target | null>(null);
  const [dialogTarget, setDialogTarget] = useState<Target | null>(null);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const open = (target: Target) => (isDesktop() ? setPaneTarget(target) : setDialogTarget(target));
  const editing = (target: Target | null) =>
    target?.kind === 'edit' ? (data.find((a) => a.id === target.id) ?? null) : null;
  // An announcement removed elsewhere closes the pane.
  const pane = paneTarget?.kind === 'edit' && !editing(paneTarget) ? null : paneTarget;

  async function removeChecked() {
    const ids = selection.checkedIds;
    const result = await run(
      () => deleteAnnouncements({ data: { ids } }),
      `${ids.length} ${ids.length === 1 ? NOUN[0] : NOUN[1]} removed.`
    );
    if (!result) return;
    if (paneTarget?.kind === 'edit' && ids.includes(paneTarget.id)) setPaneTarget(null);
    selection.clear();
  }

  async function quickPublish(a: Announcement, currentStatus: AnnouncementStatus) {
    // Ended means its expiry already passed; clear it so publishing actually goes live.
    const endsAt = currentStatus === 'ended' ? null : a.endsAt;
    await run(
      () => saveAnnouncement({ data: { ...a, enabled: true, endsAt } }),
      'Announcement published.'
    );
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

  return (
    <div className="flex flex-1 flex-col gap-4 lg:h-[calc(100svh-7.5rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl">Announcements</h1>
        {data.length > 0 && (
          <SearchInput
            label="Search announcements"
            placeholder="Search names and messages"
            value={query}
            onChange={setQuery}
          />
        )}
        {canWrite && (
          <Button size="sm" onClick={() => open({ kind: 'new' })}>
            <PlusIcon aria-hidden data-icon="inline-start" />
            New announcement
          </Button>
        )}
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
          {canWrite && (
            <EmptyContent>
              <Button size="sm" onClick={() => open({ kind: 'new' })}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                New announcement
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border lg:grid-cols-[minmax(20rem,1fr)_1fr]">
          <section aria-label="Announcements" className="flex min-h-0 flex-col lg:border-r">
            {canWrite ? (
              <SelectionBar
                selection={selection}
                visibleIds={visible.map((a) => a.id)}
                title="All"
                total={data.length}
                pending={pending}
                onDelete={() => setConfirmDelete(true)}
              />
            ) : (
              <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
                <span className="text-[13px] font-medium">All</span>
                <span className="text-muted-foreground text-xs tabular-nums">{data.length}</span>
              </div>
            )}
            {visible.length === 0 ? (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
                No announcements match that search.
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-1.5">
                {visible.map((a) => (
                  <AnnouncementListItem
                    key={a.id}
                    announcement={a}
                    status={status(a)}
                    clashesWith={clashes.get(a.id) ?? []}
                    selected={pane?.kind === 'edit' && pane.id === a.id}
                    canWrite={canWrite}
                    checked={selection.isChecked(a.id)}
                    selecting={selection.checkedIds.length > 0}
                    pending={pending}
                    onToggle={() => selection.toggle(a.id)}
                    onSelect={() => canWrite && open({ kind: 'edit', id: a.id })}
                    onPublish={() => quickPublish(a, status(a))}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Edit announcement" className="hidden min-h-0 flex-col lg:flex">
            {!canWrite || pane === null ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PanelRightIcon aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>No announcement selected</EmptyTitle>
                  <EmptyDescription>
                    Choose one from the list, or prepare a new one.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <BulkPane
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
                      onClick={() => setPaneTarget({ kind: 'new', from: editing(pane)! })}
                    >
                      <CopyIcon aria-hidden data-icon="inline-start" />
                      Duplicate for next time
                    </Button>
                  </div>
                )}
                {form(
                  pane,
                  (id) => setPaneTarget(id ? { kind: 'edit', id } : null),
                  (submit) => (
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPaneTarget(null)}>
                        Cancel
                      </Button>
                      {submit}
                    </div>
                  )
                )}
              </BulkPane>
            )}
          </section>
        </div>
      )}

      <ConfirmBulkDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        count={selection.checkedIds.length}
        noun={NOUN}
        description="They are deleted for good. Live ones disappear from the website."
        onConfirm={removeChecked}
      />

      {canWrite && (
        <Dialog
          open={dialogTarget !== null}
          onOpenChange={(isOpen) => !isOpen && setDialogTarget(null)}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {dialogTarget?.kind === 'edit' ? 'Edit announcement' : 'New announcement'}
              </DialogTitle>
              <DialogDescription>A banner across the top of the website.</DialogDescription>
            </DialogHeader>
            {dialogTarget &&
              form(
                dialogTarget,
                () => setDialogTarget(null),
                (submit) => (
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    {submit}
                  </DialogFooter>
                )
              )}
          </DialogContent>
        </Dialog>
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

function AnnouncementListItem({
  announcement: a,
  status,
  clashesWith,
  selected,
  canWrite,
  checked,
  selecting,
  pending,
  onToggle,
  onSelect,
  onPublish,
}: {
  announcement: Announcement;
  status: AnnouncementStatus;
  clashesWith: Announcement[];
  selected: boolean;
  canWrite: boolean;
  checked: boolean;
  selecting: boolean;
  pending: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onPublish: () => void;
}) {
  const colour = backgrounds.find((b) => b.value === a.background)!;
  const timeZone = useTimeZone();

  return (
    <li
      className={cn(
        'group flex items-start gap-1 rounded-md',
        canWrite && 'pl-1.5',
        selected ? 'bg-accent' : 'hover:bg-muted/60'
      )}
    >
      {canWrite && (
        <RowCheckbox
          label={`Select ${a.title}`}
          checked={checked}
          selecting={selecting}
          onToggle={onToggle}
          className="mt-2.5"
        />
      )}
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={onSelect}
        className={cn(
          'focus-visible:ring-ring min-w-0 flex-1 rounded-md px-1.5 py-2 text-left outline-none focus-visible:ring-1',
          (status === 'ended' || status === 'off') && 'opacity-60'
        )}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="ring-border size-2.5 shrink-0 rounded-full ring-1"
            style={{ background: colour.bg }}
          />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.title}</span>
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
      </button>
      {canWrite && (status === 'off' || status === 'ended') && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            onPublish();
          }}
          className="mt-1.5 shrink-0"
        >
          <SendIcon aria-hidden data-icon="inline-start" />
          Publish
        </Button>
      )}
    </li>
  );
}

type Device = 'mobile' | 'tablet' | 'desktop';

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
  const [device, setDevice] = useState<Device>('mobile');
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
      announcement ? 'Announcement saved.' : 'Announcement created.'
    );
    if (result) onSaved(result.id);
  }

  const shown =
    device === 'desktop'
      ? values.messageDesktop || values.messageTablet || values.message
      : device === 'tablet'
        ? values.messageTablet || values.message
        : values.message;
  const colour = backgrounds.find((b) => b.value === values.background)!;

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
          className="font-mono text-[13px]"
        />
        <p className="text-muted-foreground text-xs">
          One path per line. End with * to hide a whole section, like /section/*. Leave empty to
          show everywhere.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Preview</p>
          <div
            className="bg-muted flex gap-0.5 rounded-md p-0.5"
            role="group"
            aria-label="Screen size"
          >
            {(['mobile', 'tablet', 'desktop'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={cn(
                  'text-muted-foreground rounded px-2 py-0.5 text-xs capitalize',
                  device === d && 'bg-background text-foreground shadow-sm'
                )}
              >
                {d === 'mobile' ? 'Phone' : d}
              </button>
            ))}
          </div>
        </div>
        <div
          className={cn(
            'mx-auto flex items-center justify-center gap-x-3 gap-y-1 rounded-md px-4 py-2 text-center text-sm transition-[max-width]',
            device === 'mobile'
              ? 'max-w-[22rem] flex-wrap'
              : device === 'tablet'
                ? 'max-w-xl'
                : 'max-w-full'
          )}
          style={{ background: colour.bg, color: colour.fg }}
        >
          <span>{shown || 'Your message shows here'}</span>
          {values.ctaLabel && (
            <span
              className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
              style={{ borderColor: colour.fg }}
            >
              {values.ctaLabel}
            </span>
          )}
        </div>
        {announcement && (
          <p className="text-muted-foreground text-center text-xs">
            {statusLabels[announcementStatus({ ...draft, id: announcement.id }, now)]}:{' '}
            {windowLabel({ startsAt, endsAt }, timeZone)}
          </p>
        )}
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
