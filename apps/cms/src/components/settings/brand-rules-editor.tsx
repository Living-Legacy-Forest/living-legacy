// Settings › Brand language: the words the content score flags in posts, and
// what to write instead. Edits are part of the settings form, saved with it.
import { BRAND_RULES, BRAND_RULES_MAX, type BrandRule, type BrandSeverity } from '@ll/content';
import { useState } from 'react';
import { ChevronDownIcon, Trash2Icon } from '@/components/icons';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Pager } from '@/components/pager';
import { SearchInput } from '@/components/list/list-tools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyNote } from '@/components/empty-note';

const severityItems: { value: BrandSeverity; label: string }[] = [
  { value: 'critical', label: 'Never use' },
  { value: 'warning', label: 'Check' },
];

const PAGE_SIZE = 10;
const PAGE_SIZES = [10, 25, 50, 100] as const;

const sameAsGuide = (rules: BrandRule[]) => JSON.stringify(rules) === JSON.stringify(BRAND_RULES);

export function BrandRulesEditor({
  rules,
  onChange,
}: {
  rules: BrandRule[];
  onChange: (rules: BrandRule[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  // Phones show each word as one line and open one at a time to edit, so the list stays short.
  const isPhone = useIsMobile();
  const [open, setOpen] = useState<number | null>(null);
  const q = query.trim().toLowerCase();
  const shown = rules
    .map((rule, index) => ({ rule, index }))
    .filter(
      ({ rule }) =>
        !q || rule.match.toLowerCase().includes(q) || rule.instead.toLowerCase().includes(q)
    );
  const never = rules.filter((r) => r.severity === 'critical').length;
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  // Removing the last word on the last page moves back a page.
  const current = Math.min(page, pageCount);
  const from = (current - 1) * pageSize;
  const onPage = shown.slice(from, from + pageSize);

  const edit = (index: number, next: Partial<BrandRule>) =>
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...next } : rule)));

  function add() {
    setQuery('');
    setPage(1);
    onChange([{ match: '', instead: '', severity: 'critical' }, ...rules]);
    setOpen(0);
    // The new row is first; focus its word once it renders.
    requestAnimationFrame(() => document.getElementById('brand-rule-0-match')?.focus());
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <SearchInput
          label="Find a word"
          placeholder="Find a word"
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPage(1);
          }}
        />
        <p className="text-muted-foreground mr-auto text-xs tabular-nums">
          {rules.length} words: {never} never used, {rules.length - never} to check
        </p>
        {!sameAsGuide(rules) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([...BRAND_RULES])}
          >
            Use the guide's list
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rules.length >= BRAND_RULES_MAX}
          onClick={add}
        >
          Add a word
        </Button>
      </div>

      <div className="text-muted-foreground grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_8rem_2rem] gap-2 px-4 py-2 text-xs max-md:hidden">
        <span>Word or phrase</span>
        <span>Write instead</span>
        <span>How serious</span>
        <span className="sr-only">Remove</span>
      </div>

      {shown.length === 0 ? (
        <EmptyNote>
          {rules.length ? 'No words match.' : 'No words yet. Add one, or use the guide’s list.'}
        </EmptyNote>
      ) : (
        onPage.map(({ rule, index }) =>
          isPhone && open !== index ? (
            <PhoneRuleRow key={index} rule={rule} onOpen={() => setOpen(index)} />
          ) : (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_8rem_2rem] items-center gap-2 px-4 py-2 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:bg-(--ios-fill)/50 max-md:py-3"
            >
              <Input
                id={`brand-rule-${index}-match`}
                aria-label="Word or phrase"
                placeholder="Word or phrase"
                required
                maxLength={60}
                value={rule.match}
                onChange={(e) => edit(index, { match: e.target.value })}
              />
              <Input
                aria-label={`Write instead of ${rule.match || 'this word'}`}
                placeholder="Write instead"
                required
                maxLength={160}
                value={rule.instead}
                onChange={(e) => edit(index, { instead: e.target.value })}
                className="max-md:col-start-1 max-md:row-start-2"
              />
              <Select
                items={severityItems}
                value={rule.severity}
                onValueChange={(value) =>
                  value && edit(index, { severity: value as BrandSeverity })
                }
              >
                <SelectTrigger
                  aria-label={`How serious ${rule.match || 'this word'} is`}
                  className="w-full max-md:col-start-1 max-md:row-start-3"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {severityItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${rule.match || 'this word'}`}
                className="text-muted-foreground hover:text-destructive max-md:col-start-2 max-md:row-start-1"
                onClick={() => {
                  setOpen(null);
                  onChange(rules.filter((_, i) => i !== index));
                }}
              >
                <Trash2Icon aria-hidden className="size-4" />
              </Button>
              {isPhone && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-tint col-start-2 row-start-3 font-semibold"
                  onClick={() => setOpen(null)}
                >
                  Done
                </Button>
              )}
            </div>
          )
        )
      )}

      {shown.length > 0 && (
        <Pager
          page={current}
          pageCount={pageCount}
          total={shown.length}
          pageSize={pageSize}
          noun="words"
          label="Pages of words"
          className="mt-0 min-h-11 px-4 py-2"
          onPageChange={(next) => {
            setOpen(null);
            setPage(next);
          }}
          rows={{
            options: PAGE_SIZES,
            // A new page size starts again from the first page.
            onChange: (rows) => {
              setOpen(null);
              setPageSize(rows);
              setPage(1);
            },
          }}
        />
      )}
    </>
  );
}

/**
 * A word on a phone, closed: the word, what to write instead and how serious it is on one row.
 * Tapping it opens the fields. A missing "write instead" shows here, since saving refuses it.
 */
function PhoneRuleRow({ rule, onOpen }: { rule: BrandRule; onOpen: () => void }) {
  const needsInstead = !rule.instead.trim();
  return (
    <button
      type="button"
      aria-expanded={false}
      onClick={onOpen}
      className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-(--ios-fill)"
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[1.0625rem]',
            !rule.match.trim() && 'text-(--ios-secondary)'
          )}
        >
          {rule.match || 'New word'}
        </span>
        <span
          className={cn(
            'block truncate text-[0.8125rem]',
            needsInstead ? 'text-destructive' : 'text-(--ios-secondary)'
          )}
        >
          {needsInstead ? 'Add what to write instead' : rule.instead}
        </span>
      </span>
      <span className="shrink-0 text-[0.9375rem] text-(--ios-secondary)">
        {rule.severity === 'critical' ? 'Never' : 'Check'}
      </span>
      <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-(--ios-secondary) opacity-60" />
    </button>
  );
}
