import { cn } from '@/lib/utils';
import { SELECTED_RING } from '@/lib/ui-states';
import type { Theme } from '@/server/settings';

const order: Theme[] = ['light', 'dark', 'system'];

/** A tiny window in the theme: a page, a panel on it, and three lines of text. */
function Preview({ theme }: { theme: Theme }) {
  const lines = (tone: string) => (
    <span className="flex flex-col gap-1">
      <span className={cn('h-1 w-6 rounded-full', tone)} />
      <span className={cn('h-1 w-10 rounded-full', tone)} />
      <span className={cn('h-1 w-8 rounded-full', tone)} />
    </span>
  );
  const light = (
    <span className="flex h-full flex-1 items-end bg-neutral-100 pt-3 pl-3">
      <span className="h-full w-full rounded-tl-md bg-white p-2 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
        {lines('bg-neutral-200')}
      </span>
    </span>
  );
  const dark = (
    <span className="flex h-full flex-1 items-end bg-neutral-900 pt-3 pl-3">
      <span className="h-full w-full rounded-tl-md bg-neutral-800 p-2">
        {lines('bg-neutral-600')}
      </span>
    </span>
  );
  return (
    <span aria-hidden className="flex h-16 overflow-hidden rounded-[7px]">
      {theme === 'light'
        ? light
        : theme === 'dark'
          ? dark
          : [light, dark].map((half, i) => (
              // The system tile is half of each, the way it switches with the device.
              <span key={i} className="flex flex-1 overflow-hidden">
                {half}
              </span>
            ))}
    </span>
  );
}

/**
 * Light, dark or following the device, as three pictures to choose from. Radio buttons under
 * the hood, so arrow keys move between them and screen readers hear a choice of three.
 */
export function ThemeTiles({
  id,
  value,
  labels,
  onChange,
}: {
  /** The group's id, and the radio buttons' shared name. */
  id: string;
  value: Theme;
  labels: Record<Theme, string>;
  onChange: (theme: Theme) => void;
}) {
  return (
    <div id={id} role="radiogroup" aria-label="Theme" className="flex gap-3">
      {order.map((theme) => (
        <label
          key={theme}
          className="group min-w-0 flex-1 cursor-pointer space-y-1.5 sm:w-32 sm:flex-none"
        >
          <input
            type="radio"
            name={id}
            value={theme}
            checked={value === theme}
            onChange={() => onChange(theme)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'bg-muted/60 block rounded-[10px] p-[3px] transition-[background-color,box-shadow]',
              'peer-focus-visible:ring-ring/50 peer-focus-visible:ring-2',
              value === theme ? cn('bg-muted', SELECTED_RING) : 'group-hover:bg-muted'
            )}
          >
            <Preview theme={theme} />
          </span>
          <span
            className={cn(
              'block text-sm',
              value === theme ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {labels[theme]}
          </span>
        </label>
      ))}
    </div>
  );
}
