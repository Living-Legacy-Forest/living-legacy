import { cn } from '@/lib/utils';
import { ICON_STROKE, ICON_STROKE_ATTR } from './icon-stroke';

/**
 * The button for a panel on the right, drawn still (no hover motion), as Linear draws it: a
 * frame with a bar down its right side, an outline while the panel is closed and a solid bar
 * while it is open, so the icon itself says which way the click will go.
 */
export function PanelToggleIcon({
  open,
  className,
  ...props
}: { open: boolean } & React.SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="4" width="18" height="16" rx="4.5" />
      {open ? (
        <rect x="13" y="8" width="4.5" height="8" rx="1.25" fill="currentColor" stroke="none" />
      ) : (
        <path d="M15.5 9V15" />
      )}
    </svg>
  );
}
