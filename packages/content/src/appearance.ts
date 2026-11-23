import { z } from 'zod';

/**
 * A person's own look for the CMS: a colour picked on the Appearance field and how much grain
 * the sidebar has. Either can be null, which follows the site's setting.
 */
export const appearanceSchema = z.object({
  colour: z
    .object({
      /** Around the colour wheel, in degrees. */
      hue: z.number().min(0).max(360),
      /** From grey (0) to the most saturated the palette allows (1). */
      strength: z.number().min(0).max(1),
    })
    .nullable(),
  /** From none (0) to strong (1); 0.5 matches the default. */
  grain: z.number().min(0).max(1).nullable(),
});

export type Appearance = z.infer<typeof appearanceSchema>;
export type AppearanceColour = NonNullable<Appearance['colour']>;

export const DEFAULT_APPEARANCE: Appearance = { colour: null, grain: null };

/** The grain a person sees before they set it, matching the stylesheet's own. */
export const DEFAULT_GRAIN = 0.5;

/** Reads the stored column; anything unreadable follows the site. */
export function parseAppearance(value: unknown): Appearance {
  if (typeof value !== 'string' || !value) return DEFAULT_APPEARANCE;
  try {
    const result = appearanceSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

const MAX_CHROMA = 0.16;
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The four values the stylesheet builds a palette from (styles.css, [data-colour]). A stronger
 * colour sits lighter in light mode and darker in dark mode, so a saturated primary keeps its
 * colour, while a faint one goes towards the near-black and near-white of the neutral theme.
 */
export function tintValues({ hue, strength }: AppearanceColour) {
  return {
    h: Math.round(hue * 10) / 10,
    c: round(strength * MAX_CHROMA),
    l: round(0.3 + strength * 0.24),
    lDark: round(0.9 - strength * 0.16),
  };
}

/** The colour as that mode's primary shows it, for swatches and the picker's dot. */
export function colourCss(colour: AppearanceColour, mode: 'light' | 'dark' = 'light'): string {
  const { h, c, l, lDark } = tintValues(colour);
  return `oklch(${mode === 'dark' ? lDark : l} ${c} ${h})`;
}

/** Grey noise at the given alpha, as a CSS image; at 0 there is none. */
export function grainImage(opacity: number): string {
  if (opacity <= 0) return 'none';
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/>" +
    "<feColorMatrix type='saturate' values='0'/></filter>" +
    `<rect width='100%' height='100%' filter='url(#n)' opacity='${round(opacity)}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Every custom property `appearanceVars` can set, so a change can clear the ones it drops. */
export const APPEARANCE_VARS = [
  '--tint-h',
  '--tint-c',
  '--tint-l',
  '--tint-l-dark',
  '--grain-light',
  '--grain-dark',
] as const;

/**
 * The custom properties for <html>: the tint when a colour is picked, the grain when it is set.
 * Grain shows less in dark mode, where the same alpha reads stronger.
 */
export function appearanceVars(appearance: Appearance): Record<string, string> {
  const vars: Record<string, string> = {};
  if (appearance.colour) {
    const { h, c, l, lDark } = tintValues(appearance.colour);
    vars['--tint-h'] = String(h);
    vars['--tint-c'] = String(c);
    vars['--tint-l'] = String(l);
    vars['--tint-l-dark'] = String(lDark);
  }
  if (appearance.grain !== null) {
    vars['--grain-light'] = grainImage(appearance.grain * 0.22);
    vars['--grain-dark'] = grainImage(appearance.grain * 0.18);
  }
  return vars;
}

/** One-tap colours under the field. */
export const appearancePresets: { name: string; colour: AppearanceColour }[] = [
  { name: 'Green', colour: { hue: 156, strength: 0.85 } },
  { name: 'Teal', colour: { hue: 195, strength: 0.7 } },
  { name: 'Blue', colour: { hue: 255, strength: 0.85 } },
  { name: 'Purple', colour: { hue: 300, strength: 0.65 } },
  { name: 'Pink', colour: { hue: 350, strength: 0.6 } },
  { name: 'Red', colour: { hue: 25, strength: 0.9 } },
  { name: 'Orange', colour: { hue: 50, strength: 0.9 } },
  { name: 'Amber', colour: { hue: 85, strength: 0.85 } },
  { name: 'Stone', colour: { hue: 60, strength: 0.1 } },
  { name: 'Slate', colour: { hue: 260, strength: 0.25 } },
];
