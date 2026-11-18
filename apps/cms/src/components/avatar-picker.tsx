import { useState } from 'react';
import {} from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { avatarUrl, randomAvatarSeeds } from '@/lib/avatar';
import { cn } from '@/lib/utils';

const COUNT = 24;

/**
 * A grid of drawn avatars to choose from, so people pick a face that suits
 * them rather than being given one. Show more draws a fresh set.
 */
export function AvatarPicker({
  open,
  onOpenChange,
  current,
  onPick,
  title = 'Choose an avatar',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The avatar already chosen, kept in the grid so it can be seen. */
  current: string | null;
  onPick: (seed: string) => Promise<void> | void;
  title?: string;
}) {
  const fresh = () => {
    const seeds = randomAvatarSeeds(COUNT);
    return current ? [current, ...seeds.slice(0, COUNT - 1)] : seeds;
  };
  const [seeds, setSeeds] = useState(fresh);
  const [chosen, setChosen] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);

  async function use() {
    if (!chosen) return;
    setSaving(true);
    try {
      await onPick(chosen);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setSeeds(fresh());
          setChosen(current);
        }
        onOpenChange(next);
      }}
    >
      {/* No initial focus: a ring on the first face would read as already chosen. */}
      <DialogContent initialFocus={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick the one that feels most like you. Show more draws a new set.
          </DialogDescription>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Avatars"
          className="grid grid-cols-4 gap-3 sm:grid-cols-6"
        >
          {seeds.map((seed, index) => (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={chosen === seed}
              aria-label={`Avatar ${index + 1}`}
              onClick={() => setChosen(seed)}
              className={cn(
                'focus-visible:ring-ring/50 ring-offset-background aspect-square overflow-hidden rounded-full ring-offset-2 transition outline-none focus-visible:ring-3',
                chosen === seed ? 'ring-primary ring-2' : 'opacity-90 hover:opacity-100'
              )}
            >
              <img src={avatarUrl(seed)} alt="" loading="lazy" className="size-full" />
            </button>
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => setSeeds(fresh())}>
            Show more
          </Button>
          <Button type="button" disabled={!chosen || saving} onClick={use}>
            {saving ? <Spinner /> : null}
            Use this avatar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
