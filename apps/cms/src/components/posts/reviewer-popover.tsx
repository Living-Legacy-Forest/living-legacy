import { useState } from 'react';
import { SendIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

const ANYONE = 'anyone';

/**
 * "Submit for review", with a choice of who gets emailed: a specific person
 * who can publish, or everyone who can (the default).
 */
export function ReviewerPopover({
  reviewers,
  disabled,
  size = 'sm',
  label = 'Submit for review',
  onSubmit,
}: {
  reviewers: { id: string; name: string }[];
  disabled?: boolean;
  size?: 'sm' | 'icon-sm';
  /** The button's words; the phone bar has room for one. */
  label?: string;
  onSubmit: (reviewerId: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string>(ANYONE);
  const [pending, setPending] = useState(false);

  const items = [
    { value: ANYONE, label: 'Anyone who can publish' },
    ...reviewers.map((r) => ({ value: r.id, label: r.name })),
  ];

  async function submit() {
    setPending(true);
    const ok = await onSubmit(choice === ANYONE ? null : choice);
    setPending(false);
    if (ok) setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setChoice(ANYONE);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            size={size}
            variant={size === 'icon-sm' ? 'ghost' : 'default'}
            disabled={disabled}
            aria-label="Submit for review"
          />
        }
      >
        <SendIcon aria-hidden data-icon="inline-start" />
        {size === 'sm' && label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <p className="text-ui font-medium">Submit for review</p>
        <div className="space-y-1.5">
          <Label htmlFor="reviewer-select" className="text-muted-foreground text-xs">
            Reviewer
          </Label>
          <Select items={items} value={choice} onValueChange={(value) => value && setChoice(value)}>
            <SelectTrigger id="reviewer-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled={pending} onClick={submit}>
            {pending && <Spinner data-icon="inline-start" />}
            Send
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
