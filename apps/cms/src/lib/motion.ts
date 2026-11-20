import type { Transition } from 'motion/react';
import { motionTokens } from '@/components/arc/motion-tokens';

/**
 * Timings the CMS shares, so the same kind of movement takes the same time on every page.
 * Panels and layout shifts glide for 300ms; small things appearing and leaving use the
 * `standard` and `exit` durations from the motion tokens.
 */

/**
 * Two tiers. Large areas (an editor's side panel, a list's detail pane) glide for 300ms on
 * `cubic-bezier(0.32,0.72,0,1)`. Smaller things that open and close in place (sections,
 * revealed rows, the sidebar's columns) take 200ms on `cubic-bezier(0.25,1,0.5,1)`.
 * These are class strings, so Tailwind can see them.
 */

/** The small tier's timing, for anything that opens and closes in place. */
export const SECTION_MOTION =
  'duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none';

/** A collapsible section's body: height and opacity close together on the small tier's timing. */
export const COLLAPSIBLE_CONTENT =
  'h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 ' +
  SECTION_MOTION;

/**
 * The gap beside an editor's side panel, which closes with the panel so the card does not jump.
 * Matches the panel's own glide (300ms, no overshoot). A class string, so Tailwind can see it.
 */
export const PANE_GAP_MOTION =
  'motion-reduce:transition-none lg:transition-[margin-right] lg:duration-300 lg:ease-[cubic-bezier(0.32,0.72,0,1)]';

/** Something small coming into view: a label, a status line, a bar. */
export const enterTransition: Transition = {
  duration: motionTokens.duration.standard,
  ease: [...motionTokens.ease.enter] as [number, number, number, number],
};

/** The same thing leaving, a little quicker than it arrived. */
export const exitTransition: Transition = {
  duration: motionTokens.duration.exit,
  ease: [...motionTokens.ease.standard] as [number, number, number, number],
};
