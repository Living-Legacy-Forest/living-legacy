import { toTags } from '@ll/content';
import { useState } from 'react';
import { XIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

/**
 * Tags as removable chips. Enter or a comma adds what was typed; picking a
 * suggestion adds it straight away. Tags are tidied with `toTags`.
 */
export function TagInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = (text: string) => {
    onChange(toTags([...value, ...text.split(',')]));
    setDraft('');
  };

  return (
    <div className="border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border bg-transparent px-1.5 py-1 transition-colors focus-within:ring-3">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-0.5 pr-0.5 font-mono">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="hover:bg-foreground/10 rounded-sm p-0.5"
          >
            <XIcon aria-hidden className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        list={`${id}-suggestions`}
        value={draft}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(e) => {
          // Choosing from the suggestion list replaces the text in one go.
          const picked = (e.nativeEvent as InputEvent).inputType === 'insertReplacementText';
          if (picked || e.target.value.includes(',')) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent px-1 text-base outline-none md:text-sm"
      />
      <datalist id={`${id}-suggestions`}>
        {suggestions
          .filter((tag) => !value.includes(tag))
          .map((tag) => (
            <option key={tag} value={tag} />
          ))}
      </datalist>
    </div>
  );
}
