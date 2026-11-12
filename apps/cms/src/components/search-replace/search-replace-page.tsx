// Find a phrase everywhere in the CMS, see every match in context, then replace
// it in the areas ticked. Nothing changes until the replacement is confirmed,
// and a changed phrase or option needs a new search first, so what is replaced
// is always what was shown.
import { type SearchReplaceInput, searchReplaceSchema } from '@ll/content';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { SearchReplaceIcon } from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { notify } from '@/lib/notify';
import { useAction } from '@/lib/use-action';
import {
  type AreaId,
  type AreaMatch,
  type ItemMatch,
  replaceContent,
  searchContent,
} from '@/server/search-replace';
import { useRevealOnce } from '@/lib/use-reveal-once';
import { RevealWords } from '@/components/dashboard/reveal-words';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const empty: SearchReplaceInput = { find: '', replace: '', matchCase: false, wholeWords: false };

export function SearchReplacePage() {
  const [input, setInput] = useState(empty);
  // What the results below were found with; replacing uses exactly this.
  const [searched, setSearched] = useState<SearchReplaceInput | null>(null);
  const [results, setResults] = useState<AreaMatch[] | null>(null);
  const [chosen, setChosen] = useState<Set<AreaId>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [searching, setSearching] = useState(false);
  const { run, pending } = useAction();
  const patch = (next: Partial<SearchReplaceInput>) => setInput((v) => ({ ...v, ...next }));
  const stale = searched !== null && JSON.stringify(searched) !== JSON.stringify(input);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const parsed = searchReplaceSchema.safeParse(input);
    if (!parsed.success) {
      notify.error('Check the search', parsed.error.issues[0]!.message);
      document.getElementById('sr-find')?.focus();
      return;
    }
    setSearching(true);
    try {
      const found = await searchContent({ data: parsed.data });
      setResults(found);
      setSearched(parsed.data);
      setChosen(new Set(found.map((a) => a.area)));
    } catch (error) {
      notify.error('Could not search', error);
    } finally {
      setSearching(false);
    }
  }

  async function replace() {
    if (!searched) return;
    setConfirming(false);
    const result = await run(() => replaceContent({ data: { ...searched, areas: [...chosen] } }), {
      success: (r) =>
        r.matches === 0
          ? { title: 'Nothing to replace', description: 'The content changed since the search.' }
          : {
              title: `Replaced ${plural(r.matches, 'match', 'matches')}`,
              description: `In ${plural(r.items, 'item')}. Each published page keeps its previous version in its history.`,
            },
      error: 'Could not replace',
    });
    // Search again, so the page shows what is left (usually nothing).
    if (result) await search();
  }

  const shown = results ?? [];
  const total = shown.reduce((sum, a) => sum + a.count, 0);
  const items = shown.reduce((sum, a) => sum + a.items.length, 0);
  const selected = shown.filter((a) => chosen.has(a.area));
  const selectedCount = selected.reduce((sum, a) => sum + a.count, 0);
  const selectedItems = selected.reduce((sum, a) => sum + a.items.length, 0);
  const toggle = (area: AreaId, on: boolean) =>
    setChosen((set) => {
      const next = new Set(set);
      if (on) next.add(area);
      else next.delete(area);
      return next;
    });

  const revealing = useRevealOnce();

  return (
    <div
      data-slot="stack-page"
      data-revealing={revealing || undefined}
      className="mx-auto w-full max-w-4xl space-y-6"
    >
      <div className="space-y-1">
        <h1 data-slot="page-title" className="text-xl font-semibold tracking-tight">
          <RevealWords text="Search & replace" />
        </h1>
        <p className="text-muted-foreground text-sm">
          Find a word or phrase across posts, pages, events and the rest of the CMS, then replace it
          everywhere at once. You see every match before anything changes.
        </p>
      </div>

      <form onSubmit={search} className="space-y-4 rounded-xl border p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sr-find">Find</Label>
            <Input
              id="sr-find"
              value={input.find}
              maxLength={200}
              placeholder="A word or phrase"
              autoComplete="off"
              onChange={(e) => patch({ find: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sr-replace">Replace with</Label>
            <Input
              id="sr-replace"
              value={input.replace}
              maxLength={500}
              placeholder="Leave empty to remove it"
              autoComplete="off"
              onChange={(e) => patch({ replace: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={input.matchCase}
              onCheckedChange={(matchCase) => patch({ matchCase })}
            />
            Match case
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={input.wholeWords}
              onCheckedChange={(wholeWords) => patch({ wholeWords })}
            />
            Whole words only
          </label>
          <Button type="submit" className="ml-auto max-sm:w-full" disabled={searching}>
            {searching ? <Spinner /> : <SearchReplaceIcon aria-hidden data-icon="inline-start" />}
            Find matches
          </Button>
        </div>
      </form>

      {results !== null &&
        (shown.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
            No matches for “{searched?.find}”.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">
                <span className="font-medium">{plural(total, 'match', 'matches')}</span> in{' '}
                {plural(items, 'item')}. Untick an area to leave it as it is.
              </p>
              <Button
                className="ml-auto max-sm:w-full"
                disabled={pending || stale || selectedCount === 0}
                onClick={() => setConfirming(true)}
              >
                {pending ? <Spinner /> : null}
                Replace {plural(selectedCount, 'match', 'matches')}
              </Button>
            </div>
            {stale && (
              <p className="text-muted-foreground text-sm">
                The search changed. Find matches again before replacing.
              </p>
            )}
            {shown.map((area) => (
              <AreaResults
                key={area.area}
                area={area}
                replacement={searched?.replace ?? ''}
                checked={chosen.has(area.area)}
                onCheckedChange={(on) => toggle(area.area, on)}
              />
            ))}
          </div>
        ))}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Replace {plural(selectedCount, 'match', 'matches')} in {plural(selectedItems, 'item')}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              “{searched?.find}” becomes{' '}
              {searched?.replace ? `“${searched.replace}”` : 'nothing (it is removed)'}. Published
              posts and legal pages change on the website straight away; each keeps its previous
              version in its history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void replace()}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AreaResults({
  area,
  replacement,
  checked,
  onCheckedChange,
}: {
  area: AreaMatch;
  replacement: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `sr-area-${area.area}`;
  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2.5">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(on) => onCheckedChange(on === true)}
        />
        <Label htmlFor={id} className="font-medium">
          {area.label}
        </Label>
        <Badge variant="secondary" className="ml-auto tabular-nums">
          {plural(area.count, 'match', 'matches')}
        </Badge>
      </div>
      <ul className={checked ? 'divide-y' : 'divide-y opacity-50'}>
        {area.items.map((item) => (
          <ItemResult key={item.key} item={item} replacement={replacement} />
        ))}
      </ul>
    </section>
  );
}

function ItemResult({ item, replacement }: { item: ItemMatch; replacement: string }) {
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <Link
          to={item.link as never}
          className="min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline"
        >
          {item.title}
        </Link>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
          {plural(item.count, 'match', 'matches')}
        </span>
      </div>
      <dl className="space-y-1.5">
        {item.fields.map((field) => (
          <div
            key={field.label}
            className="grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[10rem_1fr]"
          >
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="space-y-1">
              {field.snippets.map((s, i) => (
                <p key={i} className="break-words">
                  {s.before}
                  <del className="bg-destructive/10 text-destructive decoration-destructive/50 rounded-sm px-0.5">
                    {s.match}
                  </del>
                  {replacement && (
                    <ins className="rounded-sm bg-emerald-500/15 px-0.5 text-emerald-800 no-underline dark:text-emerald-300">
                      {replacement}
                    </ins>
                  )}
                  {s.after}
                </p>
              ))}
              {field.count > field.snippets.length && (
                <p className="text-muted-foreground">
                  and {plural(field.count - field.snippets.length, 'more match', 'more matches')}
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
