import { type CoverageRow, coverageCounts } from '@ll/content';
import { useRef, useState } from 'react';
import { CopyIcon, UploadIcon } from '@/components/icons';
import { Pager } from '@/components/pager';
import { RevealWords } from '@/components/dashboard/reveal-words';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL } from '@/components/form-cells';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatInteger } from '@/lib/format';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import { usePaged } from '@/lib/use-paged';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { type RedirectCoverage, checkRedirectCoverage } from '@/server/redirect-coverage';
import { importRedirects } from '@/server/redirects';
import { GlideHighlight } from '@/components/ui/glide-highlight';
import { EmptyNote } from '@/components/empty-note';

type Tab = 'missing' | 'redirected' | 'live';

/** Rows are tall, with an address and a box to type in, so a page is short. */
const PAGE_SIZES = [10, 25, 50, 100] as const;

const listClass =
  'overflow-hidden rounded-lg bg-muted/50 max-md:overflow-hidden max-md:rounded-[10px] max-md:border-0 max-md:bg-(--ios-cell)';

const noun = (n: number) => `${formatInteger(n)} ${n === 1 ? 'address' : 'addresses'}`;

/**
 * For the move to the national site: paste the old site's addresses, see which already have a
 * redirect, which are still a page on the new site, and send the rest somewhere in one go.
 */
export function RedirectCoveragePage({ switcher }: { switcher?: React.ReactNode }) {
  const { run, pending } = useAction();
  const revealing = useRevealOnce();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<RedirectCoverage | null>(null);
  const [tab, setTab] = useState<Tab>('missing');
  // Where each missing address will go, kept as the list changes tab or page.
  const [targets, setTargets] = useState<Record<string, string>>({});

  const rows = result?.rows ?? [];
  const counts = coverageCounts(rows);
  const shown = rows.filter((row) => row.status === tab);
  const paged = usePaged(shown, `${tab}:${rows.length}`, PAGE_SIZES);
  const missing = rows.filter((row) => row.status === 'missing');
  const ready = missing.filter((row) => targets[row.path]?.trim());

  const show = (coverage: RedirectCoverage) => {
    setResult(coverage);
    const next = coverageCounts(coverage.rows);
    setTab(next.missing > 0 ? 'missing' : next.redirected > 0 ? 'redirected' : 'live');
  };

  async function check() {
    const coverage = await run(() => checkRedirectCoverage({ data: { text } }), {
      error: 'Could not check the addresses',
    });
    if (coverage) show(coverage);
  }

  async function create() {
    const toCreate = ready.map((row, i) => ({
      row: i + 1,
      fromPath: row.path,
      toPath: targets[row.path]!.trim(),
      statusCode: 301,
      enabled: true,
      keepQuery: true,
    }));
    const outcome = await run(
      async () => {
        let added = 0;
        const skipped: { row: number; reason: string }[] = [];
        // The server takes up to 500 a time.
        for (let i = 0; i < toCreate.length; i += 500) {
          const part = await importRedirects({ data: { rows: toCreate.slice(i, i + 500) } });
          added += part.added;
          skipped.push(...part.skipped);
        }
        // Checked again, so what was just created moves to Redirected.
        const coverage = await checkRedirectCoverage({ data: { text } });
        return { added, skipped, coverage };
      },
      {
        error: 'Could not create the redirects',
        success: ({ added, skipped }) => ({
          title: added === 1 ? 'Created 1 redirect' : `Created ${formatInteger(added)} redirects`,
          description: skipped.length
            ? `${formatInteger(skipped.length)} not created. ${skipped
                .slice(0, 2)
                .map((s) => s.reason)
                .join(' ')}`
            : 'They apply on the website straight away.',
        }),
      }
    );
    if (!outcome) return;
    // Keep what was typed for the ones that were not created, so it is not lost.
    const stillMissing = new Set(
      outcome.coverage.rows.filter((r) => r.status === 'missing').map((r) => r.path)
    );
    setTargets((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([p]) => stillMissing.has(p)))
    );
    setResult(outcome.coverage);
  }

  async function copyMissing() {
    try {
      await navigator.clipboard.writeText(missing.map((row) => row.path).join('\n'));
      notify.success({ title: 'Copied', description: `${noun(missing.length)} on the clipboard.` });
    } catch (error) {
      notify.error('Could not copy the list', error);
    }
  }

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="w-full max-w-3xl"
    >
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 data-slot="page-title" className="text-xl">
            <RevealWords text="Redirects" />
          </h1>
          {switcher}
        </div>
        <p className="text-muted-foreground text-sm">
          Paste the old site&rsquo;s addresses to see which already have a redirect. Send each of
          the rest to the closest page that answers what people were looking for, not to the home
          page.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="old-addresses" className={FIELD_LABEL}>
          Old addresses
        </Label>
        <Textarea
          id="old-addresses"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={'/about-us/\nhttps://old-site.example/blog/some-post/'}
          className="max-h-80 font-mono"
        />
        <p className="text-muted-foreground text-xs">
          One a line, as full addresses or paths. A sitemap works too, or a column copied from a
          spreadsheet. Up to 5,000.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" disabled={pending || !text.trim()} onClick={check}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Check addresses
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon aria-hidden data-icon="inline-start" />
            Choose a file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.csv,.xml,text/plain,text/csv,text/xml,application/xml"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) setText(await file.text());
            }}
          />
        </div>
      </div>

      {result && (
        <section aria-label="Results" className="mt-8 space-y-4">
          <p className="text-sm tabular-nums" aria-live="polite">
            {rows.length === 0
              ? 'No addresses found in that.'
              : `${noun(rows.length)}: ${formatInteger(counts.redirected)} redirected, ${formatInteger(counts.live)} still ${counts.live === 1 ? 'a page' : 'pages'} on the new site, ${formatInteger(counts.missing)} ${counts.missing === 1 ? 'needs' : 'need'} a redirect.`}
          </p>
          {result.ignoredCount > 0 && (
            <p className="text-muted-foreground text-xs">
              {formatInteger(result.ignoredCount)}{' '}
              {result.ignoredCount === 1 ? 'line was' : 'lines were'} left out: an address with a
              query string, such as <span className="font-mono">/?p=12</span>, cannot be matched by
              its path.
              {result.ignored.length > 0 && (
                <span className="font-mono"> {result.ignored.slice(0, 3).join('  ')}</span>
              )}
            </p>
          )}
          {result.truncated && (
            <p className="text-muted-foreground text-xs">
              Only the first 5,000 addresses were checked. Check the rest in another go.
            </p>
          )}

          {rows.length > 0 && (
            <>
              <SegmentedControl
                label="Show"
                value={tab}
                onValueChange={setTab}
                options={[
                  { value: 'missing', label: `Need a redirect (${formatInteger(counts.missing)})` },
                  {
                    value: 'redirected',
                    label: `Redirected (${formatInteger(counts.redirected)})`,
                  },
                  { value: 'live', label: `Still pages (${formatInteger(counts.live)})` },
                ]}
                className="w-auto max-w-full"
              />

              {shown.length === 0 ? (
                <EmptyNote boxed>
                  {tab === 'missing' ? 'Every address has a redirect or a page.' : 'None.'}
                </EmptyNote>
              ) : (
                <ul className={listClass}>
                  <GlideHighlight
                    follow="hover"
                    as="li"
                    selector="[data-glide]"
                    className="bg-muted border-0! max-md:hidden"
                  />
                  {paged.shown.map((row) => (
                    <li
                      key={row.path}
                      data-glide
                      className="relative flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <p
                        className="text-ui min-w-0 truncate font-mono sm:w-2/5 sm:shrink-0"
                        title={row.path}
                      >
                        {row.path}
                      </p>
                      {tab === 'missing' ? (
                        <Input
                          aria-label={`Where ${row.path} should go`}
                          placeholder="/locations/"
                          value={targets[row.path] ?? ''}
                          onChange={(e) =>
                            setTargets((prev) => ({ ...prev, [row.path]: e.target.value }))
                          }
                          className="touch:min-h-11 font-mono sm:flex-1"
                        />
                      ) : (
                        <p className="text-muted-foreground min-w-0 flex-1 text-xs">
                          {describe(row)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {paged.needed && (
                <Pager {...paged.pager} noun="addresses" label="Pages of addresses" />
              )}

              {tab === 'missing' && missing.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button type="button" disabled={pending || ready.length === 0} onClick={create}>
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {ready.length === 0
                      ? 'Create redirects'
                      : `Create ${formatInteger(ready.length)} ${ready.length === 1 ? 'redirect' : 'redirects'}`}
                  </Button>
                  <Button type="button" variant="outline" onClick={copyMissing}>
                    <CopyIcon aria-hidden data-icon="inline-start" />
                    Copy the list
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    Only the ones with a destination are created, as 301 redirects.
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** Where a redirected or live address stands, in a line. */
function describe(row: CoverageRow) {
  if (row.status === 'live') return 'Still a page on the new site.';
  if (row.to === null) return `Marked as gone (${row.statusCode}).`;
  return `Goes to ${row.to} (${row.statusCode})${row.viaWildcard ? ', caught by a rule ending in *' : ''}.`;
}
