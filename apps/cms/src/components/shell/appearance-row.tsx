import {
  APPEARANCE_VARS,
  type Appearance,
  type AppearanceColour,
  DEFAULT_APPEARANCE,
  DEFAULT_GRAIN,
  appearancePresets,
  appearanceVars,
  colourCss,
} from '@ll/content';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { MoonIcon, PaletteIcon, SunIcon, SunMoonIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { Slider } from '@/components/ui/slider';
import { notify } from '@/lib/notify';
import { useThemeChoice } from '@/lib/use-theme-choice';
import { cn } from '@/lib/utils';
import { setMyAppearance } from '@/server/profile';
import type { Theme } from '@/server/settings';
import { SidebarRow } from './sidebar-row';

const rootRoute = getRouteApi('__root__');

/** A row in the rail that opens this person's own colour, grain and light or dark choice. */
export function AppearanceRow({ wide }: { wide: boolean }) {
  return (
    <SidebarMenuItem>
      <Popover>
        <SidebarRow icon={PaletteIcon} label="Appearance" wide={wide} render={<PopoverTrigger />} />
        <PopoverContent side="right" align="end" sideOffset={10} className="w-64 gap-3 p-3">
          <AppearancePicker />
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}

/** Writes an appearance onto <html> ahead of the save, so dragging changes the page as it goes. */
function paint(appearance: Appearance, siteColour: string) {
  const root = document.documentElement;
  for (const name of APPEARANCE_VARS) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(appearanceVars(appearance))) {
    root.style.setProperty(name, value);
  }
  root.dataset.colour = appearance.colour ? 'custom' : siteColour;
}

/**
 * The picked appearance, shown at once and saved shortly after the last change, so a drag or a
 * run of arrow presses is one save. If saving fails the page goes back to what was saved.
 */
function useAppearanceDraft() {
  const router = useRouter();
  const { appearance: saved, cmsColour } = rootRoute.useLoaderData();
  const [draft, setDraft] = useState<Appearance>(saved);
  const timer = useRef(0);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  function change(next: Appearance, commit: boolean) {
    setDraft(next);
    paint(next, cmsColour);
    if (!commit) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(next), 350);
  }

  async function save(next: Appearance) {
    try {
      await setMyAppearance({ data: next });
      await router.invalidate();
    } catch (error) {
      paint(savedRef.current, cmsColour);
      setDraft(savedRef.current);
      notify.error('Could not save your appearance', error);
    }
  }

  return { draft, change };
}

const modes: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: 'system', label: 'Match my device', icon: SunMoonIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

/** A colour in both modes' shades, for a `bg-(--swatch) dark:bg-(--swatch-dark)` element. */
const swatchVars = (colour: AppearanceColour) =>
  ({
    '--swatch': colourCss(colour),
    '--swatch-dark': colourCss(colour, 'dark'),
  }) as CSSProperties;

const sameColour = (a: AppearanceColour | null, b: AppearanceColour) =>
  !!a && Math.abs(a.hue - b.hue) < 0.5 && Math.abs(a.strength - b.strength) < 0.005;

function AppearancePicker() {
  const theme = useThemeChoice();
  const { draft, change } = useAppearanceDraft();
  const grainLabel = useId();
  const mode = theme.value === 'site' ? theme.siteTheme : theme.value;
  const grain = Math.round((draft.grain ?? DEFAULT_GRAIN) * 100);
  const isDefault = !draft.colour && draft.grain === null && theme.value === 'site';

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <PopoverTitle className="text-ui font-medium">Appearance</PopoverTitle>
        <div className="flex items-center gap-0.5" role="group" aria-label="Light or dark">
          {modes.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              title={label}
              aria-pressed={mode === value}
              className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
              onClick={() => void theme.choose(value)}
            >
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
      </div>

      <ColourField
        value={draft.colour}
        onChange={(colour, commit) => change({ ...draft, colour }, commit)}
      />

      <div className="flex justify-between" role="group" aria-label="Colours">
        {appearancePresets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            aria-label={preset.name}
            title={preset.name}
            aria-pressed={sameColour(draft.colour, preset.colour)}
            className="ring-offset-popover focus-visible:ring-ring aria-pressed:ring-foreground/70 size-4.5 rounded-full bg-(--swatch) ring-offset-2 outline-none focus-visible:ring-2 aria-pressed:ring-2 dark:bg-(--swatch-dark)"
            style={swatchVars(preset.colour)}
            onClick={() => change({ ...draft, colour: preset.colour }, true)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span id={grainLabel} className="text-ui font-medium">
            Grain
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">{grain}%</span>
        </div>
        <Slider
          aria-labelledby={grainLabel}
          value={[grain]}
          onValueChange={(value) =>
            change({ ...draft, grain: (Array.isArray(value) ? value[0] : value) / 100 }, false)
          }
          onValueCommitted={(value) =>
            change({ ...draft, grain: (Array.isArray(value) ? value[0] : value) / 100 }, true)
          }
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground -mx-1 self-start"
        disabled={isDefault}
        onClick={() => {
          change(DEFAULT_APPEARANCE, true);
          if (theme.value !== 'site') void theme.choose('site');
        }}
      >
        Use the site&apos;s look
      </Button>
    </>
  );
}

const HUE_STOPS = Array.from({ length: 13 }, (_, i) => `oklch(0.68 0.15 ${i * 30})`).join(', ');
const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * A field to drag a dot across: left to right goes round the colour wheel, top to bottom from
 * strong to grey. Arrow keys move it too (Shift for bigger steps). With no colour picked it
 * follows the site's, and shows no dot.
 */
function ColourField({
  value,
  onChange,
}: {
  value: AppearanceColour | null;
  onChange: (colour: AppearanceColour, commit: boolean) => void;
}) {
  const dragging = useRef(false);

  function pick(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp((event.clientY - rect.top) / rect.height);
    onChange({ hue: Math.round(x * 360), strength: Math.round((1 - y) * 100) / 100 }, commit);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = value ?? { hue: 156, strength: 0.85 };
    const big = event.shiftKey;
    let next: AppearanceColour | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const step = (big ? 15 : 3) * (event.key === 'ArrowLeft' ? -1 : 1);
      next = { ...current, hue: (current.hue + step + 360) % 360 };
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const step = (big ? 0.2 : 0.05) * (event.key === 'ArrowDown' ? -1 : 1);
      next = { ...current, strength: Math.round(clamp(current.strength + step) * 100) / 100 };
    }
    if (!next) return;
    event.preventDefault();
    onChange(next, true);
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Colour"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={value ? Math.round(value.hue) : undefined}
      aria-valuetext={
        value
          ? `Hue ${Math.round(value.hue)} degrees, strength ${Math.round(value.strength * 100)}%`
          : "The site's colour"
      }
      className="focus-visible:ring-ring/50 relative h-32 cursor-crosshair touch-none rounded-md outline-none select-none focus-visible:ring-[3px]"
      style={{
        backgroundImage: `linear-gradient(to top, oklch(0.62 0 0), transparent), linear-gradient(to right, ${HUE_STOPS})`,
      }}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        pick(event, false);
      }}
      onPointerMove={(event) => {
        if (dragging.current) pick(event, false);
      }}
      onPointerUp={(event) => {
        if (!dragging.current) return;
        dragging.current = false;
        pick(event, true);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        if (value) onChange(value, true);
      }}
    >
      {value && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full',
            'bg-(--swatch) shadow-[0_0_0_2px_white,0_1px_4px_rgb(0_0_0/0.35)] dark:bg-(--swatch-dark)'
          )}
          style={{
            ...swatchVars(value),
            left: `${(value.hue / 360) * 100}%`,
            top: `${(1 - value.strength) * 100}%`,
          }}
        />
      )}
    </div>
  );
}
