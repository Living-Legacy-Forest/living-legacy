import {
  type AppearanceColour,
  DEFAULT_APPEARANCE,
  DEFAULT_GRAIN,
  appearancePresets,
  colourCss,
} from '@ll/content';
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useId, useRef } from 'react';
import { SettingsRow } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import { DetentDial } from '@/components/ui/detent-dial';
import { useAppearanceDraft } from '@/lib/use-appearance-draft';
import { useThemeChoice } from '@/lib/use-theme-choice';
import { cn } from '@/lib/utils';

/** A colour in both modes' shades, for a `bg-(--swatch) dark:bg-(--swatch-dark)` element. */
const swatchVars = (colour: AppearanceColour) =>
  ({
    '--swatch': colourCss(colour),
    '--swatch-dark': colourCss(colour, 'dark'),
  }) as CSSProperties;

const sameColour = (a: AppearanceColour | null, b: AppearanceColour) =>
  !!a && Math.abs(a.hue - b.hue) < 0.5 && Math.abs(a.strength - b.strength) < 0.005;

/**
 * The rows for your own colour and grain, and the reset that puts the whole look back to the
 * site's. They sit with the theme, sidebar, contrast and icon stroke on the Appearance page.
 */
export function ColourRows() {
  const theme = useThemeChoice();
  const { draft, change } = useAppearanceDraft();
  const grainLabel = useId();
  const grain = Math.round((draft.grain ?? DEFAULT_GRAIN) * 100);
  const isDefault = !draft.colour && draft.grain === null && theme.value === 'site';

  return (
    <>
      <SettingsRow
        id="profile-colour"
        title="Colour"
        description="Drag across for the hue and down for strength, or pick one below."
        below
      >
        <div className="w-full space-y-3 sm:w-96">
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
                className="ring-offset-background focus-visible:ring-ring aria-pressed:ring-foreground/70 size-4.5 rounded-full bg-(--swatch) ring-offset-2 outline-none focus-visible:ring-2 aria-pressed:ring-2 dark:bg-(--swatch-dark)"
                style={swatchVars(preset.colour)}
                onClick={() => change({ ...draft, colour: preset.colour }, true)}
              />
            ))}
          </div>
        </div>
      </SettingsRow>

      <SettingsRow
        id="profile-grain"
        title="Grain"
        description="The sidebar's texture. Turn the dial to set it."
        suffix={<span className="text-muted-foreground text-xs tabular-nums">{grain}%</span>}
      >
        <DetentDial
          aria-labelledby={grainLabel}
          aria-valuetext={`${grain}%`}
          value={grain}
          onChange={(value, commit) => change({ ...draft, grain: value / 100 }, commit)}
        />
        <span id={grainLabel} className="sr-only">
          Grain
        </span>
      </SettingsRow>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={isDefault}
          onClick={() => {
            // Contrast and icon stroke have their own Reset, so they stay as they are.
            change(
              { ...DEFAULT_APPEARANCE, contrast: draft.contrast, iconStroke: draft.iconStroke },
              true
            );
            if (theme.value !== 'site') void theme.choose('site');
          }}
        >
          Use the site&apos;s look
        </Button>
      </div>
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
