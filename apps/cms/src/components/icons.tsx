// Hugeicons, wrapped under the same names the app used for lucide-react, so
// call sites (`<FileTextIcon aria-hidden className="size-4" />`) don't change.
import * as H from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef, useState } from 'react';
import { CalendarClock as AnimatedCalendarClock } from '@/components/animate-ui/icons/hugeicons/calendar-clock';
import { Unplug as AnimatedUnplug } from '@/components/animate-ui/icons/hugeicons/unplug';
import { ActivityIcon as AnimatedActivityIcon } from '@animateicons/react/huge/activity-icon';
import { Add01Icon as AnimatedAdd01Icon } from '@animateicons/react/huge/add-0-1-icon';
import { AlertCircleIcon as AnimatedAlertCircleIcon } from '@animateicons/react/huge/alert-circle-icon';
import { Camera01Icon as AnimatedCamera01Icon } from '@animateicons/react/huge/camera-0-1-icon';
import { Cancel01Icon as AnimatedCancel01Icon } from '@animateicons/react/huge/cancel-0-1-icon';
import { CancelCircleIcon as AnimatedCancelCircleIcon } from '@animateicons/react/huge/cancel-circle-icon';
import { CodeIcon as AnimatedCodeIcon } from '@animateicons/react/huge/code-icon';
import { CopyIcon as AnimatedCopyIcon } from '@animateicons/react/huge/copy-icon';
import { Delete02Icon as AnimatedDelete02Icon } from '@animateicons/react/huge/delete-0-2-icon';
import { DownloadIcon as AnimatedDownloadIcon } from '@animateicons/react/huge/download-icon';
import { FileAddIcon as AnimatedFileAddIcon } from '@animateicons/react/huge/file-add-icon';
import { Folder01Icon as AnimatedFolder01Icon } from '@animateicons/react/huge/folder-0-1-icon';
import { FolderAddIcon as AnimatedFolderAddIcon } from '@animateicons/react/huge/folder-add-icon';
import { Globe02Icon as AnimatedGlobe02Icon } from '@animateicons/react/huge/globe-0-2-icon';
import { HelpCircleIcon as AnimatedHelpCircleIcon } from '@animateicons/react/huge/help-circle-icon';
import { Image01Icon as AnimatedImage01Icon } from '@animateicons/react/huge/image-0-1-icon';
import { InformationCircleIcon as AnimatedInformationCircleIcon } from '@animateicons/react/huge/information-circle-icon';
import { Key01Icon as AnimatedKey01Icon } from '@animateicons/react/huge/key-0-1-icon';
import { KeyboardIcon as AnimatedKeyboardIcon } from '@animateicons/react/huge/keyboard-icon';
import { Link01Icon as AnimatedLink01Icon } from '@animateicons/react/huge/link-0-1-icon';
import { Loading02Icon as AnimatedLoading02Icon } from '@animateicons/react/huge/loading-0-2-icon';
import { Logout01Icon as AnimatedLogout01Icon } from '@animateicons/react/huge/logout-0-1-icon';
import { Mail01Icon as AnimatedMail01Icon } from '@animateicons/react/huge/mail-0-1-icon';
import { MailCheckIcon as AnimatedMailCheckIcon } from '@animateicons/react/huge/mail-check-icon';
import { Megaphone01Icon as AnimatedMegaphone01Icon } from '@animateicons/react/huge/megaphone-0-1-icon';
import { NotificationIcon as AnimatedNotificationIcon } from '@animateicons/react/huge/notification-icon';
import { RedoIcon as AnimatedRedoIcon } from '@animateicons/react/huge/redo-icon';
import { SearchIcon as AnimatedSearchIcon } from '@animateicons/react/huge/search-icon';
import { ServerIcon as AnimatedServerIcon } from '@animateicons/react/huge/server-icon';
import { Settings01Icon as AnimatedSettings01Icon } from '@animateicons/react/huge/settings-0-1-icon';
import { SidebarLeftIcon as AnimatedSidebarLeftIcon } from '@animateicons/react/huge/sidebar-left-icon';
import { SidebarRightIcon as AnimatedSidebarRightIcon } from '@animateicons/react/huge/sidebar-right-icon';
import { StarIcon as AnimatedStarIcon } from '@animateicons/react/huge/star-icon';
import { TableIcon as AnimatedTableIcon } from '@animateicons/react/huge/table-icon';
import { Tag01Icon as AnimatedTag01Icon } from '@animateicons/react/huge/tag-0-1-icon';
import { TextAlignCenterIcon as AnimatedTextAlignCenterIcon } from '@animateicons/react/huge/text-align-center-icon';
import { TextAlignJustifyIcon as AnimatedTextAlignJustifyIcon } from '@animateicons/react/huge/text-align-justify-icon';
import { TextAlignLeftIcon as AnimatedTextAlignLeftIcon } from '@animateicons/react/huge/text-align-left-icon';
import { TextAlignRightIcon as AnimatedTextAlignRightIcon } from '@animateicons/react/huge/text-align-right-icon';
import { TextIndentLessIcon as AnimatedTextIndentLessIcon } from '@animateicons/react/huge/text-indent-less-icon';
import { TextIndentMoreIcon as AnimatedTextIndentMoreIcon } from '@animateicons/react/huge/text-indent-more-icon';
import { Upload01Icon as AnimatedUpload01Icon } from '@animateicons/react/huge/upload-0-1-icon';
import { UserAdd01Icon as AnimatedUserAdd01Icon } from '@animateicons/react/huge/user-add-0-1-icon';
import { UserGroupIcon as AnimatedUserGroupIcon } from '@animateicons/react/huge/user-group-icon';
import { UserIcon as AnimatedUserIcon } from '@animateicons/react/huge/user-icon';
import { UserSettings01Icon as AnimatedUserSettings01Icon } from '@animateicons/react/huge/user-settings-0-1-icon';
import { Alert02Icon as AnimatedAlert02Icon } from '@animateicons/react/huge/alert-0-2-icon';
import { Analytics01Icon as AnimatedAnalytics01Icon } from '@animateicons/react/huge/analytics-0-1-icon';
import { ArrowLeftRightIcon as AnimatedArrowLeftRightIcon } from '@animateicons/react/huge/arrow-left-right-icon';
import { ArrowUpRight01Icon as AnimatedArrowUpRight01Icon } from '@animateicons/react/huge/arrow-up-right-0-1-icon';
import { ChartLineIcon as AnimatedChartLineIcon } from '@animateicons/react/huge/chart-line-icon';
import { CheckListIcon as AnimatedCheckListIcon } from '@animateicons/react/huge/check-list-icon';
import { CheckmarkCircle01Icon as AnimatedCheckmarkCircle01Icon } from '@animateicons/react/huge/checkmark-circle-0-1-icon';
import { CodeXmlIcon as AnimatedCodeXmlIcon } from '@animateicons/react/huge/code-xml-icon';
import { DeliveryBox01Icon as AnimatedDeliveryBox01Icon } from '@animateicons/react/huge/delivery-box-0-1-icon';
import { Edit02Icon as AnimatedEdit02Icon } from '@animateicons/react/huge/edit-0-2-icon';
import { EyeIcon as AnimatedEyeIcon } from '@animateicons/react/huge/eye-icon';
import { EyeOffIcon as AnimatedEyeOffIcon } from '@animateicons/react/huge/eye-off-icon';
import { File01Icon as AnimatedFile01Icon } from '@animateicons/react/huge/file-0-1-icon';
import { FileRemoveIcon as AnimatedFileRemoveIcon } from '@animateicons/react/huge/file-remove-icon';
import { LayoutDashboardIcon as AnimatedLayoutDashboardIcon } from '@animateicons/react/huge/layout-dashboard-icon';
import { LeftToRightListBulletIcon as AnimatedLeftToRightListBulletIcon } from '@animateicons/react/huge/left-to-right-list-bullet-icon';
import { LeftToRightListNumberIcon as AnimatedLeftToRightListNumberIcon } from '@animateicons/react/huge/left-to-right-list-number-icon';
import { LinkOffIcon as AnimatedLinkOffIcon } from '@animateicons/react/huge/link-off-icon';
import { Message01Icon as AnimatedMessage01Icon } from '@animateicons/react/huge/message-0-1-icon';
import { Location01Icon as AnimatedLocation01Icon } from '@animateicons/react/huge/location-0-1-icon';
import { NewspaperIcon as AnimatedNewspaperIcon } from '@animateicons/react/huge/newspaper-icon';
import { Pen01Icon as AnimatedPen01Icon } from '@animateicons/react/huge/pen-0-1-icon';
import { QuoteIcon as AnimatedQuoteIcon } from '@animateicons/react/huge/quote-icon';
import { SendIcon as AnimatedSendIcon } from '@animateicons/react/huge/send-icon';
import { TextBoldIcon as AnimatedTextBoldIcon } from '@animateicons/react/huge/text-bold-icon';
import { TextItalicIcon as AnimatedTextItalicIcon } from '@animateicons/react/huge/text-italic-icon';
import { TextStrikethroughIcon as AnimatedTextStrikethroughIcon } from '@animateicons/react/huge/text-strikethrough-icon';
import { TextUnderlineIcon as AnimatedTextUnderlineIcon } from '@animateicons/react/huge/text-underline-icon';
import { UndoIcon as AnimatedUndoIcon } from '@animateicons/react/huge/undo-icon';
import { cn } from '@/lib/utils';
import { CheckIcon as DrawnCheckIcon, GalleryHorizontalIcon } from './drawn-icons';

// @hugeicons/core-free-icons doesn't export its icon-data type, so derive it
// structurally from one of its own exports.
type IconData = typeof H.MinusIcon;

/** For icon-as-prop patterns (e.g. nav items), matching lucide's old `LucideIcon` type. */
export type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

function make(icon: IconData): LucideIcon {
  return function WrappedIcon({ strokeWidth, ...props }) {
    // Lucide's icons accepted a string|number strokeWidth; Hugeicons wants a number.
    const width = strokeWidth === undefined ? undefined : Number(strokeWidth);
    return <HugeiconsIcon icon={icon} strokeWidth={width} {...props} />;
  };
}

// Animated versions from AnimateIcons (Hugeicons drawings, set to move on
// hover), chosen by meaning where the names differ (Bold is text-bold, an
// external link is arrow-up-right, Hugeicons' ArrowX01 chevrons are
// chevron-x). The few with no animated match keep their static icon.
type AnimatedHandle = { startAnimation: () => void; stopAnimation: () => void };
type AnimatedComponent = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<AnimatedHandle>
>;

/** Where hovering should play an icon: the control it sits in, if any. */
// Movement is kept for controls someone points at on purpose: buttons, tabs
// and the sidebar. In menus, select boxes, list rows, form fields and other
// places an icon only labels or decorates, it stays still, so the movement
// that is left still means "this responds to you".
const HOVER_TARGET =
  'button, a[data-slot="button"], [role="tab"], [data-slot="sidebar-menu-button"]';
const QUIET =
  '[role="menu"], [role="listbox"], [role="menuitem"], [role="option"], [data-slot="select-trigger"], [data-slot="list-rows"], [data-slot="input-group"], [data-slot="badge"], [data-slot="breadcrumb"], [data-slot="calendar"], [data-slot="empty"], table';

/**
 * Calls start and stop as the control around an icon is hovered, if that
 * control is one that animates (HOVER_TARGET) and is not somewhere quiet.
 */
function useHoverPlay(
  anchor: React.RefObject<HTMLSpanElement | null>,
  start: () => void,
  stop: () => void
) {
  useEffect(() => {
    const target = anchor.current?.parentElement?.closest<HTMLElement>(HOVER_TARGET);
    if (!target || target.closest(QUIET)) return;
    target.addEventListener('pointerenter', start);
    target.addEventListener('pointerleave', stop);
    return () => {
      target.removeEventListener('pointerenter', start);
      target.removeEventListener('pointerleave', stop);
    };
    // start and stop only reach refs and setters, so the first ones serve.
  }, [anchor]);
}

/**
 * Icons from Animate UI (components/animate-ui/icons), also Hugeicons
 * drawings, for ones AnimateIcons does not animate. They take an \`animate\`
 * flag rather than a handle; the same hover rule switches it.
 */
function animateUi(
  Icon: React.ComponentType<{
    animate?: boolean;
    className?: string;
    strokeWidth?: number | string;
  }>
): LucideIcon {
  return function AnimateUiIcon({ className, strokeWidth, ...props }) {
    const anchor = useRef<HTMLSpanElement>(null);
    const [on, setOn] = useState(false);
    useHoverPlay(
      anchor,
      () => setOn(true),
      () => setOn(false)
    );
    return (
      <span ref={anchor} className="contents">
        <Icon
          {...(props as object)}
          animate={on}
          strokeWidth={strokeWidth ?? 1.5}
          className={cn('shrink-0', className)}
        />
      </span>
    );
  };
}

function animated(Icon: AnimatedComponent): LucideIcon {
  return function AnimatedIcon({ className, strokeWidth, style, ...props }) {
    const handle = useRef<AnimatedHandle>(null);
    const anchor = useRef<HTMLSpanElement>(null);

    // Play when the whole button is hovered, not only the small icon inside
    // it. Reduced motion is honoured by the icons themselves.
    useHoverPlay(
      anchor,
      () => handle.current?.startAnimation(),
      () => handle.current?.stopAnimation()
    );

    // The drawing is a fixed 24px inside a wrapper. When the call site sizes
    // the icon (size-4 and so on), stretch the drawing to fill it; otherwise
    // leave it to the parent's own svg rules, as with the static icons. The
    // stroke matches Hugeicons' 1.5 default unless one is passed.
    const sized = /(^|\s)size-/.test(String(className ?? ''));
    return (
      <span ref={anchor} className="contents">
        <Icon
          ref={handle}
          {...(props as React.HTMLAttributes<HTMLDivElement>)}
          className={cn(
            'shrink-0 [&>svg]:[stroke-width:var(--icon-stroke,1.5)]',
            sized && '[&>svg]:size-full!',
            className
          )}
          style={
            {
              ...(style as React.CSSProperties),
              ...(strokeWidth !== undefined ? { '--icon-stroke': strokeWidth } : {}),
            } as React.CSSProperties
          }
        />
      </span>
    );
  };
}

// Dashboard & stats
export const ChartPieIcon = animated(AnimatedAnalytics01Icon);
export const ChartAreaIcon = animated(AnimatedChartLineIcon);
// Plain arrows: beside a small figure, a boxed chart glyph reads as a blob.
export const TrendingUpIcon = make(H.ArrowUpRight01Icon);
export const TrendingDownIcon = make(H.ArrowDownRight01Icon);
export const ArrowUpIcon = make(H.ArrowUp01Icon);
export const ArrowDownIcon = make(H.ArrowDown01Icon);
export const MinusIcon = make(H.MinusSignIcon);
export const FilePlus2Icon = animated(AnimatedFileAddIcon);
export const MessageCircleQuestionIcon = animated(AnimatedHelpCircleIcon);
export const DownloadIcon = animated(AnimatedDownloadIcon);
export const UploadIcon = animated(AnimatedUpload01Icon);
export const CameraIcon = animated(AnimatedCamera01Icon);
export const ActivityIcon = animated(AnimatedActivityIcon);
export const UserPlusIcon = animated(AnimatedUserAdd01Icon);
export const PencilLineIcon = animated(AnimatedEdit02Icon);
export const SendIcon = animated(AnimatedSendIcon);

// Rich text editor (bare, unsuffixed names as the editor imports them)
export const Bold = animated(AnimatedTextBoldIcon);
export const Code = animated(AnimatedCodeIcon);
export const CropIcon = make(H.CropIcon);
export const LaptopIcon = make(H.LaptopIcon);
export const SmartphoneIcon = make(H.SmartPhone01Icon);
export const TabletIcon = make(H.Tablet01Icon);
export const ToggleOnIcon = make(H.ToggleOnIcon);
export const ToggleOffIcon = make(H.ToggleOffIcon);
/** A breadcrumb separator: static, since it sits in every header. */
export const BreadcrumbChevronIcon = make(H.ArrowRight01Icon);
export const FullScreenIcon = make(H.FullScreenIcon);
export const LocateIcon = make(H.Gps01Icon);
export const Heading1 = make(H.Heading01Icon);
export const Heading2 = make(H.Heading02Icon);
export const Heading3 = make(H.Heading03Icon);
export const Heading4 = make(H.Heading04Icon);
export const Heading5 = make(H.Heading05Icon);
export const Heading6 = make(H.Heading06Icon);
export const Highlighter = animated(AnimatedPen01Icon);
export const Italic = animated(AnimatedTextItalicIcon);
export const Link = animated(AnimatedLink01Icon);
export const Link2Off = animated(AnimatedLinkOffIcon);
export const List = animated(AnimatedLeftToRightListBulletIcon);
export const ListOrdered = animated(AnimatedLeftToRightListNumberIcon);
export const Minus = make(H.MinusSignIcon);
export const Redo2 = animated(AnimatedRedoIcon);
export const RemoveFormatting = make(H.RemoveFormattingIcon);
export const SquareCode = animated(AnimatedCodeXmlIcon);
export const Strikethrough = animated(AnimatedTextStrikethroughIcon);
export const Subscript = make(H.SubscriptIcon);
export const Superscript = make(H.SuperscriptIcon);
export const TextAlignCenter = animated(AnimatedTextAlignCenterIcon);
export const TextAlignEnd = animated(AnimatedTextAlignRightIcon);
export const TextAlignJustify = animated(AnimatedTextAlignJustifyIcon);
export const TextAlignStart = animated(AnimatedTextAlignLeftIcon);
export const TextQuote = animated(AnimatedQuoteIcon);
export const Underline = animated(AnimatedTextUnderlineIcon);
export const Undo2 = animated(AnimatedUndoIcon);
export const AlignCenter = animated(AnimatedTextAlignCenterIcon);
export const AlignLeft = animated(AnimatedTextAlignLeftIcon);
export const AlignRight = animated(AnimatedTextAlignRightIcon);
export const AlignJustify = animated(AnimatedTextAlignJustifyIcon);
export const MoreHorizontal = make(H.MoreHorizontalIcon);
export const Trash2 = animated(AnimatedDelete02Icon);
export const MoreVertical = make(H.MoreVerticalIcon);
export const Plus = animated(AnimatedAdd01Icon);
export const ArrowRight = make(H.ArrowRight01Icon);
export const ArrowLeft = make(H.ArrowLeft01Icon);
export const ArrowUp = make(H.ArrowUp01Icon);
export const ArrowDown = make(H.ArrowDown01Icon);
export const Keyboard = animated(AnimatedKeyboardIcon);
export const Ban = animated(AnimatedCancelCircleIcon);
export const Baseline = make(H.BaselineIcon);
export const ChevronDown = make(H.ArrowDown01Icon);
export const Code2 = animated(AnimatedCodeIcon);
export const IndentDecrease = animated(AnimatedTextIndentLessIcon);
export const IndentIncrease = animated(AnimatedTextIndentMoreIcon);
export const ListTodo = animated(AnimatedCheckListIcon);
export const Quote = animated(AnimatedQuoteIcon);
export const Table = animated(AnimatedTableIcon);

// Shared UI ("Icon"-suffixed names)
// Calendar with a clock, whose hands turn: no fixed date printed on it.
export const CalendarClockIcon = animateUi(AnimatedCalendarClock);
export const FileTextIcon = animated(AnimatedFile01Icon);
export const GlobeIcon = animated(AnimatedGlobe02Icon);
export const CheckIcon = DrawnCheckIcon;
/** The tick inside a checkbox: static, since it sits in every list row. */
export const CheckboxTickIcon = make(H.Tick02Icon);
export const ScanQrIcon = make(H.QrCodeScanIcon);
export const ChevronUpIcon = make(H.ArrowUp01Icon);
export const ChevronDownIcon = make(H.ArrowDown01Icon);
export const ChevronLeftIcon = make(H.ArrowLeft01Icon);
export const ChevronRightIcon = make(H.ArrowRight01Icon);
export const EyeIcon = animated(AnimatedEyeIcon);
export const EyeOffIcon = animated(AnimatedEyeOffIcon);
export const FolderIcon = animated(AnimatedFolder01Icon);
export const LinkIcon = animated(AnimatedLink01Icon);
export const PlusIcon = animated(AnimatedAdd01Icon);
export const TagIcon = animated(AnimatedTag01Icon);
export const Trash2Icon = animated(AnimatedDelete02Icon);
export const Undo2Icon = animated(AnimatedUndoIcon);
export const UserIcon = animated(AnimatedUserIcon);
export const CircleAlertIcon = animated(AnimatedAlertCircleIcon);
export const ExternalLinkIcon = animated(AnimatedArrowUpRight01Icon);
export const MoreHorizontalIcon = make(H.MoreHorizontalIcon);
export const PanelRightIcon = animated(AnimatedSidebarRightIcon);
export const PencilIcon = animated(AnimatedEdit02Icon);
export const RotateCcwIcon = animated(AnimatedUndoIcon);
export const SearchIcon = animated(AnimatedSearchIcon);
export const SearchXIcon = make(H.SearchRemoveIcon);
export const SearchReplaceIcon = make(H.SearchReplaceIcon);
export const XIcon = animated(AnimatedCancel01Icon);
export const ArrowRightIcon = make(H.ArrowRight01Icon);
/** A straight arrow, where ArrowRightIcon is a chevron. */
export const ArrowForwardIcon = make(H.ArrowRight02Icon);
export const ArchiveIcon = animated(AnimatedDeliveryBox01Icon);
export const LayoutDashboardIcon = animated(AnimatedLayoutDashboardIcon);
export const PanelLeftIcon = animated(AnimatedSidebarLeftIcon);
export const KeyboardIcon = animated(AnimatedKeyboardIcon);
export const KeyIcon = animated(AnimatedKey01Icon);
export const IntegrationsIcon = animateUi(AnimatedUnplug);
export const SystemIcon = animated(AnimatedServerIcon);
export const LogOutIcon = animated(AnimatedLogout01Icon);
export const BellIcon = animated(AnimatedNotificationIcon);
export const CircleCheckIcon = animated(AnimatedCheckmarkCircle01Icon);
export const InfoIcon = animated(AnimatedInformationCircleIcon);
export const TriangleAlertIcon = animated(AnimatedAlert02Icon);
export const CopyIcon = animated(AnimatedCopyIcon);
export const MegaphoneIcon = animated(AnimatedMegaphone01Icon);
export const OctagonXIcon = animated(AnimatedCancelCircleIcon);
export const LoaderIcon = animated(AnimatedLoading02Icon);
export const ArrowRightLeft = animated(AnimatedArrowLeftRightIcon);
export const CircleHelp = animated(AnimatedHelpCircleIcon);
export const ExternalLink = animated(AnimatedArrowUpRight01Icon);
export const FileText = animated(AnimatedFile01Icon);
export const ImageIcon = animated(AnimatedImage01Icon);
export const MediaIcon = GalleryHorizontalIcon;
export const LayoutDashboard = animated(AnimatedLayoutDashboardIcon);
export const Settings = animated(AnimatedSettings01Icon);
export const UserCog = animated(AnimatedUserSettings01Icon);
export const Users = animated(AnimatedUserGroupIcon);
export const UsersIcon = animated(AnimatedUserGroupIcon);
export const FileQuestionIcon = animated(AnimatedFileRemoveIcon);
export const MailCheck = animated(AnimatedMailCheckIcon);
export const MessageSquareQuoteIcon = animated(AnimatedMessage01Icon);
export const StarIcon = animated(AnimatedStarIcon);
export const CircleHelpIcon = animated(AnimatedHelpCircleIcon);
export const FolderPlusIcon = animated(AnimatedFolderAddIcon);
export const MailIcon = animated(AnimatedMail01Icon);
export const MapPinIcon = animated(AnimatedLocation01Icon);
export const NewspaperIcon = animated(AnimatedNewspaperIcon);
