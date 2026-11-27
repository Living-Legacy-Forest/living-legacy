import type { SVGProps } from 'react';
import { Svg } from './view-icons';

// The sidebar and navigation icons, drawn in the same still style as the view icons: a soft frame
// or a single outline, the app's stroke, no motion.

export function DashboardNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7.5" height="10" rx="2.5" />
      <rect x="13" y="3.5" width="7.5" height="6" rx="2.5" />
      <rect x="3.5" y="15.5" width="7.5" height="5" rx="2.5" />
      <rect x="13" y="11.5" width="7.5" height="9" rx="2.5" />
    </Svg>
  );
}

export function PageNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="3.5" />
      <path d="M9 9H15M9 12.5H15M9 16H12.5" />
    </Svg>
  );
}

export function FolderNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 8A2.5 2.5 0 0 1 6 5.5H9.5L11.5 8H18A2.5 2.5 0 0 1 20.5 10.5V16.5A2.5 2.5 0 0 1 18 19H6A2.5 2.5 0 0 1 3.5 16.5V8Z" />
    </Svg>
  );
}

export function TagNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12L19.9 11.9A1.5 1.5 0 0 1 19.9 14L14 19.9A1.5 1.5 0 0 1 11.9 19.9L4 12V5.5Z" />
      <circle cx="8.25" cy="8.25" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CalendarNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M3.5 10H20.5M8 3V6.5M16 3V6.5" />
      <circle cx="8.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function GalleryNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="3.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M4 17L9 13L12 15.5L15.5 12L20 16" />
    </Svg>
  );
}

export function MegaphoneNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6.5 4.5H17.5A3 3 0 0 1 20.5 7.5V13.5A3 3 0 0 1 17.5 16.5H12.5L8 20V16.5H6.5A3 3 0 0 1 3.5 13.5V7.5A3 3 0 0 1 6.5 4.5Z" />
      <path d="M12 8V11" />
      <circle cx="12" cy="13.25" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function NewsNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="4" y="4.5" width="16" height="15" rx="3.5" />
      <rect x="8" y="8.5" width="4" height="3.5" rx="1" />
      <path d="M14.5 9H16M14.5 12H16M8 15.5H16" />
    </Svg>
  );
}

export function ChecklistNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 6.5L5.5 8L8 5M4 12L5.5 13.5L8 10.5M4 17.5L5.5 19L8 16M12 7H20M12 12.5H20M12 18H20" />
    </Svg>
  );
}

export function PinNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 21C12 21 19 15.5 19 10A7 7 0 0 0 5 10C5 15.5 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function PieNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V12H20.5" />
    </Svg>
  );
}

export function AreaNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 20.5H20.5M4.5 16.5L9 11L13 14L19.5 6" />
    </Svg>
  );
}

export function RouteNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18H14.5A3.5 3.5 0 0 0 14.5 11H9.5A3.5 3.5 0 0 1 9.5 6H16" />
    </Svg>
  );
}

export function BrowserNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
      <path d="M3.5 9.5H20.5" />
      <circle cx="6.75" cy="7" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="9.25" cy="7" r="0.7" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function PulseNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 12H7L9.5 6.5L14.5 17.5L17 12H21" />
    </Svg>
  );
}

export function ShieldNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3.5L19 6V11.5C19 16 16 19.5 12 20.5C8 19.5 5 16 5 11.5V6L12 3.5Z" />
      <path d="M9 12L11 14L15 10" />
    </Svg>
  );
}

export function ServerNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="6.5" rx="2.5" />
      <rect x="4" y="13.5" width="16" height="6.5" rx="2.5" />
      <circle cx="7.75" cy="7.25" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7.75" cy="16.75" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function KeyNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5L19 4M16 7L18.5 9.5" />
    </Svg>
  );
}

export function SwapNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 8H18M14.5 4.5L18 8L14.5 11.5M20 16H6M9.5 12.5L6 16L9.5 19.5" />
    </Svg>
  );
}

export function HelpNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.75A2.5 2.5 0 0 1 14.5 10.25C14.5 12.25 12 12.25 12 14.25" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function TeamNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19C3.5 15.7 6 14 9 14S14.5 15.7 14.5 19" />
      <path d="M15 5.75A2.75 2.75 0 0 1 15 11.25M17 14C19.2 14.3 20.5 15.8 20.5 18.5" />
    </Svg>
  );
}

export function QuoteNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M10 7.5C7 8 5 10 5 13.5V17H10V12.5H7.5M19 7.5C16 8 14 10 14 13.5V17H19V12.5H16.5" />
    </Svg>
  );
}

export function UserNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20C5 16 8 14 12 14S19 16 19 20" />
    </Svg>
  );
}

export function UserCogNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 20C3.5 16 6.5 14 10 14" />
      <circle cx="17.5" cy="17" r="2" />
      <path d="M17.5 13.5V14.5M17.5 19.5V20.5M14 17H15M20 17H21" />
    </Svg>
  );
}

export function LayersNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 4L20.5 8.5L12 13L3.5 8.5L12 4Z" />
      <path d="M3.5 12.5L12 17L20.5 12.5M3.5 16L12 20.5L20.5 16" />
    </Svg>
  );
}

export function InfoNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11V16" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function SettingsNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M10.55 5.46 L10.76 3.19 L13.24 3.19 L13.45 5.46 L15.60 6.35 L17.36 4.89 L19.11 6.64 L17.65 8.40 L18.54 10.55 L20.81 10.76 L20.81 13.24 L18.54 13.45 L17.65 15.60 L19.11 17.36 L17.36 19.11 L15.60 17.65 L13.45 18.54 L13.24 20.81 L10.76 20.81 L10.55 18.54 L8.40 17.65 L6.64 19.11 L4.89 17.36 L6.35 15.60 L5.46 13.45 L3.19 13.24 L3.19 10.76 L5.46 10.55 L6.35 8.40 L4.89 6.64 L6.64 4.89 L8.40 6.35Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Svg>
  );
}

export function SearchSwapNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15L20 20M8 10.5H13M11 8.5L13 10.5L11 12.5" />
    </Svg>
  );
}

export function PlugNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 3.5V8M15 3.5V8M6.5 8H17.5V12A5.5 5.5 0 0 1 12 17.5A5.5 5.5 0 0 1 6.5 12V8ZM12 17.5V20.5" />
    </Svg>
  );
}

export function UserCircleNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M6.75 17.75C7.75 15.75 9.75 14.75 12 14.75S16.25 15.75 17.25 17.75" />
    </Svg>
  );
}

export function GlobeNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12H20.5" />
      <path d="M12 3.5C14.4 6 15.5 9 15.5 12S14.4 18 12 20.5C9.6 18 8.5 15 8.5 12S9.6 6 12 3.5Z" />
    </Svg>
  );
}

export function MailNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3.5" />
      <path d="M5 8.5L12 13L19 8.5" />
    </Svg>
  );
}

export function GiftNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M12 10V20M4 14H20" />
      <path d="M12 10C12 10 11 5.5 8.75 5.5A2.25 2.25 0 0 0 8.75 10H12ZM12 10C12 10 13 5.5 15.25 5.5A2.25 2.25 0 0 1 15.25 10H12Z" />
    </Svg>
  );
}

export function ShieldUserNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3.5L19 6V11.5C19 16 16 19.5 12 20.5C8 19.5 5 16 5 11.5V6L12 3.5Z" />
      <circle cx="12" cy="10.25" r="2" />
      <path d="M8.75 15.5C9.5 14.25 10.6 13.75 12 13.75S14.5 14.25 15.25 15.5" />
    </Svg>
  );
}

/** A frame with a bar down its left side: the sidebar. */
export function PanelLeftNavIcon({ open, ...props }: SVGProps<SVGSVGElement> & { open?: boolean }) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="4.5" />
      {open ? (
        <rect x="6.5" y="8" width="4.5" height="8" rx="1.25" fill="currentColor" stroke="none" />
      ) : (
        <path d="M8.5 9V15" />
      )}
    </Svg>
  );
}

/** The same, with the bar down its right side. */
export function PanelRightNavIcon({
  open,
  ...props
}: SVGProps<SVGSVGElement> & { open?: boolean }) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="4.5" />
      {open ? (
        <rect x="13" y="8" width="4.5" height="8" rx="1.25" fill="currentColor" stroke="none" />
      ) : (
        <path d="M15.5 9V15" />
      )}
    </Svg>
  );
}

export function BellNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6.5 17V11A5.5 5.5 0 0 1 17.5 11V17L19 19H5L6.5 17Z" />
      <path d="M10 21.25C10.4 21.7 11.1 22 12 22S13.6 21.7 14 21.25" />
    </Svg>
  );
}

export function EyeNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M2.75 12C4.5 7.75 8 5.5 12 5.5S19.5 7.75 21.25 12C19.5 16.25 16 18.5 12 18.5S4.5 16.25 2.75 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function EyeOffNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M2.75 12C4.5 7.75 8 5.5 12 5.5S19.5 7.75 21.25 12C19.5 16.25 16 18.5 12 18.5S4.5 16.25 2.75 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4.5 4.5L19.5 19.5" />
    </Svg>
  );
}

export function CopyNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="3" />
      <path d="M15.5 8.5V7A2.5 2.5 0 0 0 13 4.5H7A2.5 2.5 0 0 0 4.5 7V13A2.5 2.5 0 0 0 7 15.5H8.5" />
    </Svg>
  );
}

export function DownloadNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 4V15M7.5 10.5L12 15L16.5 10.5M4.5 19.5H19.5" />
    </Svg>
  );
}

export function UploadNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 15V4M7.5 8.5L12 4L16.5 8.5M4.5 19.5H19.5" />
    </Svg>
  );
}

export function StarNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 4L14.4 9.2L20 9.9L15.9 13.8L16.9 19.5L12 16.8L7.1 19.5L8.1 13.8L4 9.9L9.6 9.2Z" />
    </Svg>
  );
}

export function SunNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3V4.5M12 19.5V21M3 12H4.5M19.5 12H21M5.6 5.6L6.7 6.7M17.3 17.3L18.4 18.4M5.6 18.4L6.7 17.3M17.3 6.7L18.4 5.6" />
    </Svg>
  );
}

export function MoonNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4A6.5 6.5 0 0 0 20 14.5Z" />
    </Svg>
  );
}

export function LogOutNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9.5 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5H9.5M15.5 8L20 12L15.5 16M20 12H9.5" />
    </Svg>
  );
}

export function ArchiveNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" />
      <path d="M5 9V17A2.5 2.5 0 0 0 7.5 19.5H16.5A2.5 2.5 0 0 0 19 17V9M10 13H14" />
    </Svg>
  );
}

export function CircleCheckNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.25L11 14.75L15.75 9.75" />
    </Svg>
  );
}

export function TriangleAlertNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 4.5L20.5 19H3.5L12 4.5Z" />
      <path d="M12 10V14" />
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CircleAlertNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.75V12.5" />
      <circle cx="12" cy="15.75" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function LinkNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M10 14A4 4 0 0 0 15.7 14.3L18.5 11.5A4 4 0 0 0 12.8 5.8L11.5 7.1M14 10A4 4 0 0 0 8.3 9.7L5.5 12.5A4 4 0 0 0 11.2 18.2L12.5 16.9" />
    </Svg>
  );
}

export function SendNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M20.5 3.5L10.5 13.5M20.5 3.5L14 20.5L10.5 13.5L3.5 10L20.5 3.5Z" />
    </Svg>
  );
}

export function ChevDownNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6.5 9.5L12 15L17.5 9.5" />
    </Svg>
  );
}

export function ChevUpNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6.5 14.5L12 9L17.5 14.5" />
    </Svg>
  );
}

export function ChevLeftNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M14.5 6.5L9 12L14.5 17.5" />
    </Svg>
  );
}

export function ChevRightNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9.5 6.5L15 12L9.5 17.5" />
    </Svg>
  );
}

export function ArrowRightNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4.5 12H19.5M13.5 6L19.5 12L13.5 18" />
    </Svg>
  );
}

export function ArrowLeftNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M19.5 12H4.5M10.5 6L4.5 12L10.5 18" />
    </Svg>
  );
}

export function KeyboardNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
      <path d="M6.5 10H8M10.5 10H12M15 10H17.5M7.5 14H16.5" />
    </Svg>
  );
}

export function CameraNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8L9.5 4H14.5L16 6H17.5A2.5 2.5 0 0 1 20 8.5V16.5A2.5 2.5 0 0 1 17.5 19H6.5A2.5 2.5 0 0 1 4 16.5V8.5Z" />
      <circle cx="12" cy="12.5" r="3" />
    </Svg>
  );
}

export function PaletteNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3.5C7.3 3.5 3.5 7.1 3.5 11.8C3.5 16.5 7.3 20.5 12 20.5C13.4 20.5 14.2 19.6 14 18.5C13.8 17.3 14.6 16.5 15.8 16.5H17.5A3 3 0 0 0 20.5 13.5C20.5 8 16.8 3.5 12 3.5Z" />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7.75" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function TrendUpNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 16L10 10L13.5 13.5L20 7M15 7H20V12" />
    </Svg>
  );
}

export function TrendDownNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 8L10 14L13.5 10.5L20 17M15 17H20V12" />
    </Svg>
  );
}

export function ArrowUpNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 19.5V4.5M6 10.5L12 4.5L18 10.5" />
    </Svg>
  );
}

export function ArrowDownNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 4.5V19.5M6 13.5L12 19.5L18 13.5" />
    </Svg>
  );
}

export function PushPinNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 4.5H15L14 10L17.5 13.5V15H12.75V20L12 21L11.25 20V15H6.5V13.5L10 10L9 4.5Z" />
    </Svg>
  );
}

export function PinOffNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 4.5H15L14 10L17.5 13.5V15H12.75V20L12 21L11.25 20V15H6.5V13.5L10 10L9 4.5Z" />
      <path d="M4.5 4.5L19.5 19.5" />
    </Svg>
  );
}

export function MinusNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 12H19" />
    </Svg>
  );
}

export function FilePlusNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="3.5" />
      <path d="M12 9V15M9 12H15" />
    </Svg>
  );
}

export function FolderPlusNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 8A2.5 2.5 0 0 1 6 5.5H9.5L11.5 8H18A2.5 2.5 0 0 1 20.5 10.5V16.5A2.5 2.5 0 0 1 18 19H6A2.5 2.5 0 0 1 3.5 16.5V8Z" />
      <path d="M12 11V15M10 13H14" />
    </Svg>
  );
}

export function UserPlusNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 19.5C3.5 16.5 6.2 14.5 10 14.5M18 9V15M15 12H21" />
    </Svg>
  );
}

export function CropNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M7 3.5V17A1.5 1.5 0 0 0 8.5 18.5H20.5M3.5 7H15.5A1.5 1.5 0 0 1 17 8.5V20.5" />
    </Svg>
  );
}

export function LaptopNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="5" y="5.5" width="14" height="9.5" rx="2.5" />
      <path d="M3 19H21" />
    </Svg>
  );
}

export function MonitorNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="11" rx="3" />
      <path d="M9.5 20H14.5M12 15.5V20" />
    </Svg>
  );
}

export function SunMoonNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5A8.5 8.5 0 0 1 12 20.5Z" fill="currentColor" />
    </Svg>
  );
}

export function RetryNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M20 12A8 8 0 1 1 17.5 6.3M20 4V8.5H15.5" />
    </Svg>
  );
}

export function UploadArrowNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 19.5V5M6.5 10.5L12 5L17.5 10.5" />
    </Svg>
  );
}

export function PhoneNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="7" y="3.5" width="10" height="17" rx="2.5" />
      <path d="M11 17.5H13" />
    </Svg>
  );
}

export function TabletNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
      <path d="M11 17.5H13" />
    </Svg>
  );
}

export function ToggleOnNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="7.5" width="18" height="9" rx="4.5" />
      <circle cx="16.5" cy="12" r="2.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function ToggleOffNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="7.5" width="18" height="9" rx="4.5" />
      <circle cx="7.5" cy="12" r="2.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function FullScreenNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 9V6A2 2 0 0 1 6 4H9M15 4H18A2 2 0 0 1 20 6V9M20 15V18A2 2 0 0 1 18 20H15M9 20H6A2 2 0 0 1 4 18V15" />
    </Svg>
  );
}

export function LocateNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 3V5.5M12 18.5V21M3 12H5.5M18.5 12H21" />
    </Svg>
  );
}

export function SaveNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H15L20 9V17.5A2.5 2.5 0 0 1 17.5 20H7.5A2.5 2.5 0 0 1 5 17.5V6.5Z" />
      <path d="M8.5 4V8.5H14.5V4M8.5 20V14.5H15.5V20" />
    </Svg>
  );
}

export function ScanQrNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 9V6A2 2 0 0 1 6 4H9M15 4H18A2 2 0 0 1 20 6V9M20 15V18A2 2 0 0 1 18 20H15M9 20H6A2 2 0 0 1 4 18V15" />
      <rect x="8.5" y="8.5" width="2.5" height="2.5" rx="0.6" />
      <rect x="13" y="8.5" width="2.5" height="2.5" rx="0.6" />
      <rect x="8.5" y="13" width="2.5" height="2.5" rx="0.6" />
      <path d="M13 13H15.5V15.5" />
    </Svg>
  );
}

export function SparklesNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M10 4.5L11.8 9.2L16.5 11L11.8 12.8L10 17.5L8.2 12.8L3.5 11L8.2 9.2Z" />
      <path d="M18 3.5L18.7 5.3L20.5 6L18.7 6.7L18 8.5L17.3 6.7L15.5 6L17.3 5.3Z" />
    </Svg>
  );
}

export function UndoNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4.5 9H14.5A5 5 0 0 1 14.5 19H8M8 5L4 9L8 13" />
    </Svg>
  );
}

export function SearchXNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15L20 20M8.5 8.5L12.5 12.5M12.5 8.5L8.5 12.5" />
    </Svg>
  );
}

export function FingerprintNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3.5C7.3 3.5 4 7 4 11.5V13.5M12 7.5C9.8 7.5 8 9.3 8 11.5V14C8 16 7.5 18 6.5 19.5M12 7.5C14.2 7.5 16 9.3 16 11.5V14.5C16 17 15.5 19 14.5 20.5M12 3.5C16.7 3.5 20 7 20 11.5V15C20 17 19.7 19 19 20.5M12 11V15C12 17 11.7 18.7 11 20" />
    </Svg>
  );
}

export function CheckCheckNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 12.5L7.5 16.5L14.5 8.5M12 16.5L13 17.5L20.5 8.5" />
    </Svg>
  );
}

export function PipetteNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M13.5 6.5L17.5 10.5M15.5 4.5A2 2 0 0 1 19.5 8.5L17 11L13 7L15.5 4.5ZM13.5 8.5L5.5 16.5V18.5H7.5L15.5 10.5" />
    </Svg>
  );
}

export function VolumeNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 10V14H7.5L12.5 18V6L7.5 10H4Z" />
      <path d="M16 9.5A3.5 3.5 0 0 1 16 14.5M18.5 7A7 7 0 0 1 18.5 17" />
    </Svg>
  );
}

export function VolumeOffNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 10V14H7.5L12.5 18V6L7.5 10H4Z" />
      <path d="M16 9.5L20.5 14.5M20.5 9.5L16 14.5" />
    </Svg>
  );
}

export function MailOpenNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 10L12 4L20.5 10V17A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V10Z" />
      <path d="M4 10.5L12 15L20 10.5" />
    </Svg>
  );
}

export function MailCheckNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3.5" />
      <path d="M8.5 12.25L11 14.75L15.75 9.75" />
    </Svg>
  );
}

export function LegalNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="3.5" />
      <path d="M9 8.5H15M9 12H13" />
      <circle cx="14.5" cy="16" r="1.75" />
    </Svg>
  );
}

export function OctagonXNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8.5 3.5H15.5L20.5 8.5V15.5L15.5 20.5H8.5L3.5 15.5V8.5L8.5 3.5Z" />
      <path d="M9.5 9.5L14.5 14.5M14.5 9.5L9.5 14.5" />
    </Svg>
  );
}

export function LoaderNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 3.5A8.5 8.5 0 1 0 20.5 12" />
    </Svg>
  );
}

export function FileQuestionNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="3.5" />
      <path d="M10 10.25A2 2 0 0 1 14 10.75C14 12.5 12 12.5 12 14" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function BubbleLinesNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6.5 4.5H17.5A3 3 0 0 1 20.5 7.5V13.5A3 3 0 0 1 17.5 16.5H12.5L8 20V16.5H6.5A3 3 0 0 1 3.5 13.5V7.5A3 3 0 0 1 6.5 4.5Z" />
      <path d="M8 8.5H16M8 12H13" />
    </Svg>
  );
}

export function BanNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6L18 18" />
    </Svg>
  );
}

export function DotsVNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function TickNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 12.5L10 16.5L18 8" />
    </Svg>
  );
}
