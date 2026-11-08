import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon, KeyIcon, PlusIcon, Trash2Icon } from '@/components/icons';
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
import { DialogActions, ListDialog } from '@/components/list/list-page';
import { PageActions } from '@/components/shell/page-actions';
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
  { value: 'read', label: 'Read only', description: 'List and read posts, categories and tags.' },
  {
    value: 'write',
    label: 'Read and write',
    description: 'Also create and edit drafts. Publishing stays in the CMS.',
  },
];

const tableCellPadding = '[&_td]:px-4 [&_th]:px-4';

export function ApiKeysPage({ keys }: { keys: ApiKeyRow[] }) {
  const [creating, setCreating] = useState(false);
  const active = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
            API keys
          </h1>
          <p className="text-muted-foreground text-sm">
            Let other tools read posts and write drafts through the CMS API. A key acts as the admin
            who created it.
          </p>
        </div>
        <Button size="sm" className="max-md:hidden" onClick={() => setCreating(true)}>
          <PlusIcon aria-hidden data-icon="inline-start" />
          New API key
        </Button>
        <PageActions add={{ label: 'New API key', onClick: () => setCreating(true) }} />
        <CreateKeyDialog open={creating} onOpenChange={setCreating} />
      </div>

      <section className="space-y-2.5 max-md:space-y-1.5">
        <div className={cn('flex items-baseline gap-2', groupHeadingClass)}>
          <h2 className="text-sm font-medium max-md:text-[0.8125rem] max-md:font-normal">
            Active keys
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">{active.length}</span>
        </div>
        <div className={groupBoxClass}>
          {active.length ? (
            <KeysTable keys={active} />
          ) : (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">
              No keys yet. Create one to connect a tool.
            </p>
          )}
        </div>
      </section>

      {revoked.length > 0 && (
        <section className="space-y-2.5 max-md:space-y-1.5">
          <div className={cn('flex items-baseline gap-2', groupHeadingClass)}>
            <h2 className="text-sm font-medium max-md:text-[0.8125rem] max-md:font-normal">
              Revoked
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">{revoked.length}</span>
          </div>
          <div className={groupBoxClass}>
            <KeysTable keys={revoked} />
          </div>
        </section>
      )}

      <UsageGuide />
    </div>
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
              <Badge variant={k.scope === 'write' ? 'default' : 'secondary'}>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
        // A form so Done takes the sheet bar's place for Save on phones.
        <form
          onSubmit={(e) => {
            e.preventDefault();
            close();
          }}
          className="space-y-5"
        >
          <CopyableKey value={created} />
          <DialogActions>
            <Button type="submit">Done</Button>
          </DialogActions>
        </form>
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

function UsageGuide() {
  // Filled in after hydration: the server does not know the address the page is on.
  const [base, setBase] = useState('');
  useEffect(() => setBase(window.location.origin), []);
  const example = `curl -X POST ${base}/api/v1/posts \\
  -H "Authorization: Bearer llk_…" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My draft", "markdown": "## Hello\\n\\nWritten elsewhere."}'`;

  return (
    <section className="space-y-2.5 max-md:space-y-1.5">
      <h2 className="text-sm font-medium">Using the API</h2>
      <div className="space-y-4 rounded-lg border p-4 text-sm">
        <p className="text-muted-foreground">
          Send the key in an <code className="font-mono text-xs">Authorization: Bearer</code>{' '}
          header. Writes only ever create or edit drafts: nothing goes live until someone publishes
          it here.
        </p>
        <ul className="space-y-1.5 font-mono text-xs">
          <li>GET /api/v1/posts?status=draft&amp;q=words&amp;page=1</li>
          <li>GET /api/v1/posts/:id</li>
          <li>POST /api/v1/posts (write)</li>
          <li>PATCH /api/v1/posts/:id (write)</li>
          <li>GET /api/v1/terms</li>
        </ul>
        <p className="text-muted-foreground">
          Post fields: <code className="font-mono text-xs">title</code>,{' '}
          <code className="font-mono text-xs">markdown</code> (or the editor's{' '}
          <code className="font-mono text-xs">body</code> JSON),{' '}
          <code className="font-mono text-xs">excerpt</code>,{' '}
          <code className="font-mono text-xs">slug</code>,{' '}
          <code className="font-mono text-xs">tags</code>,{' '}
          <code className="font-mono text-xs">categoryIds</code>,{' '}
          <code className="font-mono text-xs">seoTitle</code>,{' '}
          <code className="font-mono text-xs">seoDescription</code>.
        </p>
        <CodeBlock>
          <CodeBlockActions>
            <CodeBlockCopyButton value={example} />
          </CodeBlockActions>
          <CodeBlockContent wrap>{example}</CodeBlockContent>
        </CodeBlock>
      </div>
    </section>
  );
}
