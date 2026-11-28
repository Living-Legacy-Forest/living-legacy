// The Suggest button: asks the writing assistant for one field and puts the answer in the field as
// an ordinary unsaved edit, with Undo. It never saves anything itself.
import type { AiGroup } from '@ll/content';
import { useRef, useState } from 'react';
import { SparklesIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/notify';
import { applySuggestion } from './apply-suggestion';
import { useCanSuggest } from './use-can-suggest';

/**
 * Runs one suggestion. `current` is the field's value now (re-read after the answer arrives, so
 * typing in the meantime wins), and `apply` puts a value in the field.
 */
function useSuggestion<T>(
  current: T,
  apply: (next: T) => void,
  same: (a: T, b: T) => boolean = Object.is
) {
  const latest = useRef(current);
  latest.current = current;
  const [pending, setPending] = useState(false);

  async function run(request: () => Promise<T>) {
    const before = latest.current;
    setPending(true);
    try {
      const suggestion = await request();
      const next = applySuggestion({ before, current: latest.current, suggestion }, same);
      if (next === null) {
        notify.info({
          title: 'Suggestion not added',
          description: 'The field changed while it was being written. Try again.',
        });
        return;
      }
      apply(next);
      notify.success({
        title: 'Suggestion added',
        description: 'Check it, then save as usual.',
        action: { label: 'Undo', onClick: () => apply(before) },
      });
    } catch (error) {
      notify.error('Could not suggest one', error);
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}

function Trigger({
  label,
  pending,
  onClick,
}: {
  label: string;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    // Button's extended touch area makes the xs size a 44pt target on phones.
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={onClick}
      className="text-muted-foreground"
    >
      {pending ? <Spinner className="size-3" /> : <SparklesIcon aria-hidden className="size-3" />}
      {label}
    </Button>
  );
}

/** For a text field. Reads "Rewrite" when the field already has text. */
export function SuggestButton({
  value,
  group,
  request,
  onApply,
  label,
}: {
  value: string;
  /** The kind of suggestion, which an admin can switch off in Settings. */
  group: AiGroup;
  request: () => Promise<string>;
  onApply: (next: string) => void;
  label?: string;
}) {
  const allowed = useCanSuggest(group);
  const { run, pending } = useSuggestion(value, onApply);
  if (!allowed) return null;
  return (
    <Trigger
      label={label ?? (value.trim() ? 'Rewrite' : 'Suggest')}
      pending={pending}
      onClick={() => void run(request)}
    />
  );
}

const sameTags = (a: string[], b: string[]) => a.join('\u0000') === b.join('\u0000');

/** For tags: adds the suggested ones that are not already on the post. */
export function SuggestTagsButton({
  tags,
  request,
  onApply,
}: {
  tags: string[];
  request: () => Promise<string[]>;
  onApply: (next: string[]) => void;
}) {
  const allowed = useCanSuggest('tags');
  const { run, pending } = useSuggestion(tags, onApply, sameTags);
  if (!allowed) return null;
  return (
    <Trigger
      label="Suggest tags"
      pending={pending}
      onClick={() =>
        void run(async () => {
          const have = new Set(tags.map((tag) => tag.toLowerCase()));
          const added = (await request()).filter((tag) => !have.has(tag.toLowerCase()));
          if (added.length === 0) {
            throw new Error('Every tag that fits is already there.');
          }
          return [...tags, ...added];
        })
      }
    />
  );
}
