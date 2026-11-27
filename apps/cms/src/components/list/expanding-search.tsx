import { useEffect, useRef, useState } from 'react';
import { SearchStillIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * A search that is only an icon until it is wanted. The same box widens from the icon to the
 * field and back, so the icon never moves and nothing swaps; the field fades in as it widens. It
 * folds back when it is left empty, Esc clears it, and anything typed keeps it open so a filter in
 * force is never hidden.
 */
export function ExpandingSearch({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(value !== '');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value !== '') setOpen(true);
  }, [value]);

  const expand = () => {
    setOpen(true);
    input.current?.focus();
  };

  return (
    <div
      role="search"
      className={cn(
        'relative h-8 shrink-0 overflow-hidden rounded-md transition-[width,background-color] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none',
        open ? 'bg-muted/60 focus-within:bg-muted w-52' : 'hover:bg-accent w-8'
      )}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        title="Search"
        // Keeps the field focused when the icon is pressed again.
        onMouseDown={(event) => open && event.preventDefault()}
        onClick={expand}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-0 left-0 grid size-8 place-items-center rounded-md outline-none focus-visible:ring-2"
      >
        <SearchStillIcon aria-hidden className="size-4" />
      </button>
      {/* Always the field's full width, so widening the box reveals it instead of squeezing it. */}
      <input
        ref={input}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        tabIndex={open ? 0 : -1}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => value === '' && setOpen(false)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          onChange('');
          setOpen(false);
          input.current?.blur();
        }}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          'text-ui absolute inset-y-0 left-0 w-52 bg-transparent pr-2 pl-8 transition-opacity duration-150 outline-none motion-reduce:transition-none',
          open
            ? 'placeholder:text-muted-foreground opacity-100 delay-75'
            : 'pointer-events-none opacity-0'
        )}
      />
    </div>
  );
}
