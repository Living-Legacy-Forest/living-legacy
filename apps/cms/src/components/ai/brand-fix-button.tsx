// "Suggest a fix" for one brand problem: a small popover that shows the sentence, asks the writing
// assistant to rewrite it, and offers Copy (and, where the text can be replaced in place, Use it).
import { useState } from 'react';
import { SparklesIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { notify } from '@/lib/notify';
import { suggestBrandFix } from '@/server/ai';
import { useCanSuggest } from './use-can-suggest';

/** The server's own limits on what it is sent. */
const MAX_SENTENCE = 2000;
const MAX_FOUND = 100;

export function BrandFixButton({
  sentence,
  found,
  limit,
  apply,
  label = 'Suggest a fix',
}: {
  sentence: string;
  found: string;
  /** The longest the rewrite may be. */
  limit: number;
  /** Puts the rewrite in place. Left out where it cannot be (the body), leaving Copy. */
  apply?: (rewrite: string) => void;
  label?: string;
}) {
  const allowed = useCanSuggest();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<
    { status: 'idle' } | { status: 'pending' } | { status: 'done'; text: string }
  >({
    status: 'idle',
  });
  if (!allowed || sentence.length > MAX_SENTENCE || found.length > MAX_FOUND) return null;

  async function ask() {
    setState({ status: 'pending' });
    try {
      const { text } = await suggestBrandFix({
        data: { text: sentence, found, limit: Math.min(MAX_SENTENCE, Math.max(1, limit)) },
      });
      setState({ status: 'done', text });
    } catch (error) {
      setState({ status: 'idle' });
      setOpen(false);
      notify.error('Could not suggest a fix', error);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify.success({
        title: 'Copied',
        description: 'Paste it in place of the sentence.',
      });
    } catch (error) {
      notify.error('Could not copy it', error);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && state.status === 'idle') void ask();
      }}
    >
      {/* Button's extended touch area makes the xs size a 44pt target on phones. */}
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-label={`Suggest a fix for “${found}”`}
            className="text-muted-foreground"
          />
        }
      >
        <SparklesIcon aria-hidden className="size-3" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-muted-foreground text-xs">Now</p>
        <p className="text-ui">{sentence}</p>
        <p className="text-muted-foreground text-xs">Suggested</p>
        {state.status === 'done' ? (
          <>
            <p className="text-ui">{state.text}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {apply && (
                <Button
                  type="button"
                  size="xs"
                  onClick={() => {
                    apply(state.text);
                    setOpen(false);
                  }}
                >
                  Use it
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => void copy(state.text)}
              >
                Copy
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner className="size-3" />
            Writing a fix
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
