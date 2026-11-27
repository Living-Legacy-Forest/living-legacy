import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { ICON_STROKE, ICON_STROKE_ATTR } from './icon-stroke';

// Still icons drawn to match the panel toggle: a rounded frame with one or two plain shapes in it,
// the app's stroke, no motion. They stand in for the library's busier list, grid and sliders.

export function Svg({ className, children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      {...ICON_STROKE_ATTR}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** A frame with two rows in it. */
export function RowsViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="4.5" />
      <path d="M8 9.5H16M8 14.5H16" />
    </Svg>
  );
}

/** A frame split into four. */
export function CellsViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="4.5" />
      <path d="M12 4V20M3 12H21" />
    </Svg>
  );
}

/** Two sliders, each with a round knob. */
export function KnobsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 8H12M18 8H20M4 16H6M12 16H20" />
      <circle cx="15" cy="8" r="2.25" />
      <circle cx="9" cy="16" r="2.25" />
    </Svg>
  );
}

/** A funnel with soft corners. */
export function FunnelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4.5 5.5H19.5L14 12.25V18.5L10 16.5V12.25L4.5 5.5Z" />
    </Svg>
  );
}

/** Three bars, each shorter than the last. */
export function BarsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 7H20M4 12H15M4 17H10" />
    </Svg>
  );
}

/** A round lens with a short handle. */
export function LensIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16L20 20" />
    </Svg>
  );
}

export function PlusMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 5V19M5 12H19" />
    </Svg>
  );
}

export function CrossMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 6L18 18M18 6L6 18" />
    </Svg>
  );
}

/** Three dots, filled so they stay round at small sizes. */
export function DotsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** A pencil lying at an angle, its tip at the lower left. */
export function PencilNibIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4.5 19.5L5.25 15.25L15.5 5A2.12 2.12 0 0 1 19 8.5L8.75 18.75L4.5 19.5Z" />
      <path d="M13.5 7L17 10.5" />
    </Svg>
  );
}

/** A bin with a lid and two slots. */
export function BinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4.5 7H19.5M9.5 7V5A1 1 0 0 1 10.5 4H13.5A1 1 0 0 1 14.5 5V7" />
      <path d="M6.5 7L7.25 18.25A1.75 1.75 0 0 0 9 19.75H15A1.75 1.75 0 0 0 16.75 18.25L17.5 7" />
      <path d="M10.25 11V16M13.75 11V16" />
    </Svg>
  );
}

/** An arrow leaving a box. */
export function ArrowOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M14 5H19V10M19 5L11.5 12.5" />
      <path d="M17 14.5V16.5A2.5 2.5 0 0 1 14.5 19H7.5A2.5 2.5 0 0 1 5 16.5V9.5A2.5 2.5 0 0 1 7.5 7H9.5" />
    </Svg>
  );
}
