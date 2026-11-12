import { slugify } from '@ll/content';
import { useState } from 'react';
import { CheckIcon, PlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SITE_HOST } from './seo-fields';

export type Option = { id: string; name: string };

/** Tags are stored by name; existing and assigned ones form the option list. */
export function tagOptions(existing: string[], assigned: string[]): Option[] {
  return [...new Set([...existing, ...assigned])]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, name }));
}

const valueButtonClass =
  'h-7 w-full justify-start gap-1.5 px-2 text-ui font-normal hover:bg-accent data-[popup-open]:bg-accent';

/** Pick any number of options, or type a new one to create it. */
export function MultiPicker({
  label,
  options,
  selected,
  placeholder,
  onChange,
  onCreate,
}: {
  label: string;
  options: Option[];
  selected: string[];
  placeholder: string;
  onChange: (ids: string[]) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim();
  const exists = options.some((o) => o.name.toLowerCase() === query.toLowerCase());
  const names = options.filter((o) => selected.includes(o.id)).map((o) => o.name);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <Popover onOpenChange={(open) => !open && setSearch('')}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={cn(valueButtonClass, names.length > 0 && 'h-auto min-h-7 py-1')}
            aria-label={`${label}: ${names.join(', ') || 'none'}`}
          />
        }
      >
        <Chips names={names} placeholder={placeholder} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput
            placeholder={`Find or create ${label.toLowerCase()}…`}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="p-0">
              <PickerEmpty />
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => toggle(option.id)}>
                  <CheckIcon
                    aria-hidden
                    className={cn(
                      'size-3.5',
                      selected.includes(option.id) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
              {query && !exists && (
                <CommandItem
                  value={`create ${query}`}
                  onSelect={async () => {
                    await onCreate(query);
                    setSearch('');
                  }}
                >
                  <PlusIcon aria-hidden className="size-3.5" />
                  Create “{query}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Pick one option, or none. */
export function SinglePicker({
  label,
  options,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string | null;
  placeholder: string;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={valueButtonClass}
            aria-label={`${label}: ${current?.name ?? 'none'}`}
          />
        }
      >
        {current ? (
          <span className="truncate">{current.name}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput placeholder={`Find ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty className="p-0">
              <PickerEmpty />
            </CommandEmpty>
            <CommandGroup>
              {[{ id: '', name: placeholder }, ...options].map((option) => (
                <CommandItem
                  key={option.id || 'none'}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id || null);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    aria-hidden
                    className={cn(
                      'size-3.5',
                      (value ?? '') === option.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The permalink. `liveSlug` is the published one, if any, so the popover can
 * warn that changing it adds a redirect.
 */
export function UrlPicker({
  slug,
  liveSlug,
  onChange,
}: {
  slug: string;
  liveSlug: string | null;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(slug);
  const changed = liveSlug !== null && slug !== liveSlug;
  const commit = () => {
    onChange(slugify(draft));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(slug);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={valueButtonClass}
            aria-label={`URL: /blog/${slug || ''}`}
          />
        }
      >
        <span className="truncate">
          <span className="text-muted-foreground">/blog/</span>
          {slug || <span className="text-muted-foreground">…</span>}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="post-slug" className="text-xs">
            Permalink
          </Label>
          <Input
            id="post-slug"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
            }}
            className="h-9"
          />
          <p className="text-muted-foreground truncate text-xs">
            {SITE_HOST}/blog/{slugify(draft) || '…'}
          </p>
        </div>
        {(changed || (liveSlug !== null && slugify(draft) !== liveSlug)) && (
          <p className="text-muted-foreground text-xs">
            The old link /blog/{liveSlug} will redirect here once you publish the changes.
          </p>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={commit}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Chips({ names, placeholder }: { names: string[]; placeholder: string }) {
  if (names.length === 0) return <span className="text-muted-foreground">{placeholder}</span>;
  return (
    <span className="flex min-w-0 flex-wrap gap-1">
      {names.map((name) => (
        <span key={name} className="bg-muted truncate rounded px-1.5 py-px text-xs">
          {name}
        </span>
      ))}
    </span>
  );
}

/** Compact empty state for the pickers. */
function PickerEmpty() {
  return (
    <Empty className="gap-1 p-4">
      <EmptyHeader className="gap-1">
        <EmptyTitle className="text-ui">No matches</EmptyTitle>
        <EmptyDescription className="text-xs">Try a different name.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
