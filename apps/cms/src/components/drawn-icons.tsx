import { cn } from '@/lib/utils';
import { ICON_STROKE, ICON_STROKE_ATTR } from './icon-stroke';

// Hugeicons drawings from Animate UI, kept as plain SVG with their motion
// redone in CSS (styles.css, `.drawn-icon`), so they cost no animation
// library. They play when the control they sit in is hovered.

type DrawnIconProps = React.SVGProps<SVGSVGElement>;

function DrawnSvg({ className, strokeWidth, children, ...props }: DrawnIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? ICON_STROKE}
      {...(strokeWidth === undefined && ICON_STROKE_ATTR)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('drawn-icon shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Two cards either side of a frame; the sides slide in on hover. */
export function GalleryHorizontalIcon({ className, ...props }: DrawnIconProps) {
  return (
    <DrawnSvg className={cn('drawn-gallery', className)} {...props}>
      <path data-side="start" d="M2 6V18" />
      <path d="M13 3L11 3C8.64298 3 7.46447 3 6.73223 3.73223C6 4.46447 6 5.64298 6 8L6 16C6 18.357 6 19.5355 6.73223 20.2678C7.46447 21 8.64298 21 11 21H13C15.357 21 16.5355 21 17.2678 20.2678C18 19.5355 18 18.357 18 16V8C18 5.64298 18 4.46447 17.2678 3.73223C16.5355 3 15.357 3 13 3Z" />
      <path data-side="end" d="M22 6V18" />
    </DrawnSvg>
  );
}

/** A tick that redraws itself on hover. */
export function CheckIcon({ className, ...props }: DrawnIconProps) {
  return (
    <DrawnSvg className={cn('drawn-check', className)} {...props}>
      <path
        pathLength={1}
        d="M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7"
      />
    </DrawnSvg>
  );
}
