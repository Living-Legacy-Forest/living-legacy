import { useState } from 'react';
import { XIcon } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { isComposing } from '@/lib/keyboard';

/** Short phrases as removable chips. Type one, then press Enter or a comma. */
export function TermsInput({
  id,
  terms,
  max,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string;
  terms: string[];
  max: number;
  maxLength: number;
  placeholder: string;
  onChange: (terms: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const full = terms.length >= max;

  function add() {
    const term = draft.trim();
    setDraft('');
    if (!term || full) return;
    if (terms.some((t) => t.toLowerCase() === term.toLowerCase())) return;
    onChange([...terms, term]);
  }

  return (
    <div className="space-y-1.5">
      {terms.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {terms.map((term) => (
            <li
              key={term}
              className="bg-muted flex items-center gap-0.5 rounded-md py-0.5 pr-0.5 pl-2 text-xs"
            >
              {term}
              <button
                type="button"
                aria-label={`Remove ${term}`}
                onClick={() => onChange(terms.filter((t) => t !== term))}
                className="text-muted-foreground hover:text-foreground touch:size-8 grid size-5 place-items-center rounded"
              >
                <XIcon aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        maxLength={maxLength}
        disabled={full}
        placeholder={full ? `Up to ${max} terms` : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (isComposing(e)) return;
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && terms.length) {
            onChange(terms.slice(0, -1));
          }
        }}
        onBlur={add}
        className="text-ui md:text-ui touch:h-11 h-9"
      />
    </div>
  );
}
