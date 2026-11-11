import { useEffect, useState } from 'react';
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  KeyIcon,
  PlusIcon,
  Trash2Icon,
} from '@/components/icons';
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
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
} from '@/components/ui/code-block';
import { FormCell, FormSection, groupBoxClass, groupHeadingClass } from '@/components/form-cells';
import { SegmentedControl } from '@/components/segmented-control';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { DialogActions, ListDialog } from '@/components/list/list-page';
import { PageActions } from '@/components/shell/page-actions';
import { useSheetSaved } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import { reportInvalid } from '@/lib/form-validation';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';
import { type ApiKeyRow, createApiKey, revokeApiKey } from '@/server/api-keys';

type Scope = ApiKeyRow['scope'];

const scopeItems: { value: Scope; label: string; description: string }[] = [
  {
    value: 'read',
    label: 'Read only',
    description: 'Read posts, categories and tags, and check wording against the brand guide.',
  },
  {
    value: 'write',
    label: 'Read and write',
    description: 'Also create drafts and edit posts. Publishing stays in the CMS.',
  },
];

const tableCellPadding = '[&_td]:px-4 [&_th]:px-4';

export function IntegrationsPage({ keys, origin }: { keys: ApiKeyRow[]; origin: string }) {
  const [creating, setCreating] = useState(false);
  const active = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);
  const create = () => setCreating(true);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            Integrations
          </h1>
          <p className="text-muted-foreground text-sm">
            Connect AI tools such as Claude, and your own scripts, to read posts and write drafts.
            Each connection uses an API key, which acts as the admin who created it.
          </p>
        </div>
        <Button size="sm" className="max-md:hidden" onClick={create}>
          <PlusIcon aria-hidden data-icon="inline-start" />
          New API key
        </Button>
        <PageActions add={{ label: 'New API key', onClick: create }} />
        <CreateKeyDialog open={creating} onOpenChange={setCreating} origin={origin} />
      </div>

      <section className="space-y-2.5 max-md:space-y-1.5">
        <div className={cn('flex items-baseline gap-2', groupHeadingClass)}>
          <h2 className="text-sm font-medium max-md:text-[0.8125rem] max-md:font-normal">
            Active API keys
          </h2>
          {active.length > 0 && (
            <span className="text-muted-foreground text-xs tabular-nums">{active.length}</span>
          )}
        </div>
        {active.length ? (
          <div className={groupBoxClass}>
            <KeysTable keys={active} />
          </div>
        ) : (
          <Empty className="rounded-lg border max-md:border-0 max-md:bg-(--ios-cell)">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No API keys yet</EmptyTitle>
              <EmptyDescription>
                Create a key for each tool you connect, so you can revoke one without the others.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={create}>
                <PlusIcon aria-hidden data-icon="inline-start" />
                New API key
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>

      {revoked.length > 0 && <RevokedKeys keys={revoked} />}

      <ConnectGuide origin={origin} />
    </div>
  );
}

function RevokedKeys({ keys }: { keys: ApiKeyRow[] }) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          'group text-muted-foreground hover:text-foreground touch:min-h-11 flex min-h-8 items-center gap-1 text-sm font-medium',
          groupHeadingClass
        )}
      >
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 transition-transform duration-150 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
        Revoked API keys
        <span className="ml-1 text-xs font-normal tabular-nums">{keys.length}</span>
      </CollapsibleTrigger>
      {/* Height animates from Base UI's measured panel height; instant with reduced motion. */}
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
        <div className={cn('mt-2.5 max-md:mt-1.5', groupBoxClass)}>
          <KeysTable keys={keys} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function KeysTable({ keys }: { keys: ApiKeyRow[] }) {
  const { run } = useAction();
  const timeZone = useTimeZone();

  return (
    <Table className={tableCellPadding}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead className="w-32">Access</TableHead>
          <TableHead className="w-32 max-sm:hidden">Last used</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((k) => (
          <TableRow key={k.id} className={cn(k.revokedAt && 'text-muted-foreground')}>
            <TableCell className="w-full max-w-0 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{k.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  <code className="font-mono">{k.prefix}…</code> · created{' '}
                  {formatDate(k.createdAt, timeZone)}
                  {k.createdByName ? ` by ${k.createdByName}` : ''}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={k.revokedAt ? 'outline' : k.scope === 'write' ? 'default' : 'secondary'}
              >
                {k.scope === 'write' ? 'Read and write' : 'Read only'}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm max-sm:hidden">
              {k.revokedAt
                ? `Revoked ${formatDate(k.revokedAt, timeZone)}`
                : k.lastUsedAt
                  ? formatRelative(k.lastUsedAt)
                  : 'Never'}
            </TableCell>
            <TableCell>
              {!k.revokedAt && (
                <RevokeKey
                  name={k.name}
                  onConfirm={() =>
                    run(() => revokeApiKey({ data: { id: k.id } }), {
                      success: {
                        title: 'Key revoked',
                        description: `${k.name} stops working now. Anything using it needs a new key.`,
                      },
                      error: 'Could not revoke the key',
                    })
                  }
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RevokeKey({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Revoke ${name}`}
            className="text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke "{name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Anything using this key stops working straight away. This cannot be undone; create a new
            key if you need access again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Revoke</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange: setOpen,
  origin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
}) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<Scope>('read');
  const [created, setCreated] = useState<string | null>(null);
  const { run, pending } = useAction();

  function reset() {
    setName('');
    setScope('read');
    setCreated(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportInvalid(e.currentTarget)) return;
    const result = await run(() => createApiKey({ data: { name, scope } }), {
      error: 'Could not create the key',
    });
    if (result) setCreated(result.key);
  }

  function close() {
    setOpen(false);
    reset();
  }

  return (
    <ListDialog
      open={open}
      onClose={close}
      title={created ? 'Copy your key' : 'New API key'}
      description={
        created
          ? 'This is the only time the key is shown. Store it somewhere safe, like a password manager.'
          : 'Name it after the tool that will use it, so you know which to revoke later.'
      }
      icon={
        <span className="bg-muted text-foreground mb-1 flex size-10 items-center justify-center rounded-lg">
          <KeyIcon aria-hidden className="size-5" />
        </span>
      }
    >
      {created ? (
        <CreatedKey value={created} origin={origin} onDone={close} />
      ) : (
        <form noValidate onSubmit={submit} className="space-y-5 max-md:space-y-7">
          <FormSection>
            <FormCell label="Name" htmlFor="api-key-name">
              <Input
                id="api-key-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Blog writing assistant"
              />
            </FormCell>
          </FormSection>
          <div className="space-y-2 max-md:space-y-1.5">
            <Label className={groupHeadingClass}>Access</Label>
            <FormSection>
              <div className="grid grid-cols-2 gap-2">
                {scopeItems.map((item) => {
                  const selected = scope === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setScope(item.value)}
                      className={cn(
                        'focus-visible:ring-ring rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2',
                        selected
                          ? 'border-foreground bg-muted/50'
                          : 'border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs">{item.description}</div>
                    </button>
                  );
                })}
              </div>
            </FormSection>
          </div>
          <DialogActions>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Create key
            </Button>
          </DialogActions>
        </form>
      )}
    </ListDialog>
  );
}

/**
 * The new key, shown once. The key is saved, so closing loses nothing: no
 * "Discard changes?" on phones and no Cancel beside Done.
 */
function CreatedKey({
  value,
  origin,
  onDone,
}: {
  value: string;
  origin: string;
  onDone: () => void;
}) {
  const markSaved = useSheetSaved();
  useEffect(markSaved, [markSaved]);
  const command = connectSnippet('claude', origin, value);
  return (
    // A form so Done takes the sheet bar's place for Save on phones.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onDone();
      }}
      className="space-y-5"
    >
      <CopyableKey value={value} />
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          To connect Claude Code, run this in a terminal. The key is already in it.
        </p>
        <CodeBlock size="sm">
          <CodeBlockActions>
            <CodeBlockCopyButton value={command} />
          </CodeBlockActions>
          <CodeBlockContent wrap>{command}</CodeBlockContent>
        </CodeBlock>
      </div>
      <DialogActions cancel={false}>
        <Button type="submit">Done</Button>
      </DialogActions>
    </form>
  );
}

function CopyableKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error('Could not copy', 'Select the key and copy it yourself.');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={value}
        className="font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <Button variant="outline" size="icon" onClick={copy} aria-label="Copy key">
        {copied ? (
          <CheckIcon aria-hidden className="size-4" />
        ) : (
          <CopyIcon aria-hidden className="size-4" />
        )}
      </Button>
    </div>
  );
}

type Method = 'claude' | 'mcp' | 'api';

const methods: { value: Method; label: string }[] = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'mcp', label: 'Other AI apps' },
  { value: 'api', label: 'REST API' },
];

const PLACEHOLDER_KEY = 'llk_…';

function connectSnippet(method: Method, origin: string, key = PLACEHOLDER_KEY) {
  switch (method) {
    case 'claude':
      return `claude mcp add --transport http living-legacy ${origin}/mcp \\
  --header "Authorization: Bearer ${key}"`;
    case 'mcp':
      return JSON.stringify(
        {
          mcpServers: {
            'living-legacy': {
              type: 'http',
              url: `${origin}/mcp`,
              headers: { Authorization: `Bearer ${key}` },
            },
          },
        },
        null,
        2
      );
    case 'api':
      return `curl -X POST ${origin}/api/v1/posts \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My draft", "markdown": "## Hello\\n\\nWritten elsewhere."}'`;
  }
}

// What an AI tool connected over MCP can do, in the order it tends to do it.
const abilities: { text: string; write?: boolean }[] = [
  { text: 'List and read posts, with their text as Markdown' },
  { text: 'Read the brand language guide before it writes' },
  { text: 'Check wording against the guide, and see a post’s content score' },
  { text: 'Create drafts, and edit posts', write: true },
];

function ConnectGuide({ origin }: { origin: string }) {
  const [method, setMethod] = useState<Method>('claude');
  const snippet = connectSnippet(method, origin);

  return (
    <section className="space-y-2.5 max-md:space-y-1.5">
      <h2 className={cn('text-sm font-medium', groupHeadingClass)}>Connect a tool</h2>
      <div className="space-y-4 rounded-lg border p-4 text-sm max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)">
        <SegmentedControl
          label="How to connect"
          value={method}
          onValueChange={setMethod}
          options={methods}
        />

        {method === 'claude' && (
          <p className="text-muted-foreground">
            Run this in a terminal, with your key in place of{' '}
            <code className="font-mono text-xs">{PLACEHOLDER_KEY}</code>. Then ask Claude to draft a
            post: it finds the CMS’s tools and the brand guide on its own.
          </p>
        )}
        {method === 'mcp' && (
          <p className="text-muted-foreground">
            The CMS is an MCP server at <code className="font-mono text-xs">{origin}/mcp</code>.
            Apps that take a server address and headers, such as Cursor, accept an entry like this.
            Connectors in the Claude app need a sign-in step the CMS does not offer yet, so use
            Claude Code there.
          </p>
        )}
        {method === 'api' && (
          <p className="text-muted-foreground">
            For your own scripts. Send the key in an{' '}
            <code className="font-mono text-xs">Authorization: Bearer</code> header.
          </p>
        )}

        <CodeBlock>
          <CodeBlockActions>
            <CodeBlockCopyButton value={snippet} />
          </CodeBlockActions>
          <CodeBlockContent wrap>{snippet}</CodeBlockContent>
        </CodeBlock>

        {method === 'api' ? <ApiReference /> : <Abilities />}
      </div>
    </section>
  );
}

function Abilities() {
  return (
    <div className="space-y-2 border-t pt-4">
      <h3 className="text-sm font-medium">What it can do</h3>
      <ul className="space-y-1.5">
        {abilities.map((a) => (
          <li key={a.text} className="flex items-start gap-2">
            <CheckIcon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span>
              {a.text}
              {a.write && (
                <Badge variant="secondary" className="ml-2 align-middle">
                  Read and write key
                </Badge>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        Nothing it writes goes live. Drafts and edits wait here until someone publishes them, and
        each change shows in Activity under the key’s name.
      </p>
    </div>
  );
}

const endpoints: { method: string; path: string; write?: boolean }[] = [
  { method: 'GET', path: '/api/v1/posts?status=draft&q=words&page=1' },
  { method: 'GET', path: '/api/v1/posts/:id' },
  { method: 'POST', path: '/api/v1/posts', write: true },
  { method: 'PATCH', path: '/api/v1/posts/:id', write: true },
  { method: 'GET', path: '/api/v1/terms' },
];

const postFields = [
  'title',
  'markdown',
  'excerpt',
  'slug',
  'tags',
  'categoryIds',
  'seoTitle',
  'seoDescription',
];

function ApiReference() {
  return (
    <div className="space-y-3 border-t pt-4">
      <ul className="space-y-1.5 font-mono text-xs">
        {endpoints.map((e) => (
          <li key={e.method + e.path} className="flex items-baseline gap-2">
            <span className="text-muted-foreground w-12 shrink-0">{e.method}</span>
            <span className="min-w-0 break-all">{e.path}</span>
            {e.write && (
              <Badge variant="secondary" className="ml-auto font-sans">
                Write
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        Post fields:{' '}
        {postFields.map((f, i) => (
          <span key={f}>
            <code className="font-mono text-xs">{f}</code>
            {i < postFields.length - 1 ? ', ' : '. '}
          </span>
        ))}
        Send <code className="font-mono text-xs">body</code> with the editor’s JSON instead of
        markdown if you have it. Writes only create or edit drafts.
      </p>
    </div>
  );
}
