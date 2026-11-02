// Hugeicons, wrapped under the same names the app used for lucide-react, so
// call sites (`<FileTextIcon aria-hidden className="size-4" />`) don't change.
import * as H from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef } from 'react';
import { ActivityIcon as AnimatedActivityIcon } from '@animateicons/react/huge/activity-icon';
import { Add01Icon as AnimatedAdd01Icon } from '@animateicons/react/huge/add-0-1-icon';
import { AlertCircleIcon as AnimatedAlertCircleIcon } from '@animateicons/react/huge/alert-circle-icon';
import { Camera01Icon as AnimatedCamera01Icon } from '@animateicons/react/huge/camera-0-1-icon';
import { Cancel01Icon as AnimatedCancel01Icon } from '@animateicons/react/huge/cancel-0-1-icon';
import { CancelCircleIcon as AnimatedCancelCircleIcon } from '@animateicons/react/huge/cancel-circle-icon';
import { ChevronDownIcon as AnimatedChevronDownIcon } from '@animateicons/react/huge/chevron-down-icon';
import { ChevronLeftIcon as AnimatedChevronLeftIcon } from '@animateicons/react/huge/chevron-left-icon';
import { ChevronRightIcon as AnimatedChevronRightIcon } from '@animateicons/react/huge/chevron-right-icon';
import { ChevronUpIcon as AnimatedChevronUpIcon } from '@animateicons/react/huge/chevron-up-icon';
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
import { KeyboardIcon as AnimatedKeyboardIcon } from '@animateicons/react/huge/keyboard-icon';
import { Link01Icon as AnimatedLink01Icon } from '@animateicons/react/huge/link-0-1-icon';
import { Loading02Icon as AnimatedLoading02Icon } from '@animateicons/react/huge/loading-0-2-icon';
import { Logout01Icon as AnimatedLogout01Icon } from '@animateicons/react/huge/logout-0-1-icon';
import { Mail01Icon as AnimatedMail01Icon } from '@animateicons/react/huge/mail-0-1-icon';
import { MailCheckIcon as AnimatedMailCheckIcon } from '@animateicons/react/huge/mail-check-icon';
import { Megaphone01Icon as AnimatedMegaphone01Icon } from '@animateicons/react/huge/megaphone-0-1-icon';
import { MoreHorizontalIcon as AnimatedMoreHorizontalIcon } from '@animateicons/react/huge/more-horizontal-icon';
import { MoreVerticalIcon as AnimatedMoreVerticalIcon } from '@animateicons/react/huge/more-vertical-icon';
import { NotificationIcon as AnimatedNotificationIcon } from '@animateicons/react/huge/notification-icon';
import { RedoIcon as AnimatedRedoIcon } from '@animateicons/react/huge/redo-icon';
import { SearchIcon as AnimatedSearchIcon } from '@animateicons/react/huge/search-icon';
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
import { cn } from '@/lib/utils';

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
// hover). Only icons that set has a true match for are swapped; the rest
// stay static above, in the same Hugeicons style.
type AnimatedHandle = { startAnimation: () => void; stopAnimation: () => void };
type AnimatedComponent = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<AnimatedHandle>
>;

/** Where hovering should play an icon: the control it sits in, if any. */
const HOVER_TARGET =
  'a, button, label, summary, [role="menuitem"], [role="option"], [role="tab"], [data-slot="sidebar-menu-button"]';

function animated(Icon: AnimatedComponent): LucideIcon {
  return function AnimatedIcon({ className, strokeWidth, style, ...props }) {
    const handle = useRef<AnimatedHandle>(null);
    const anchor = useRef<HTMLSpanElement>(null);

    // Play when the whole button or menu row is hovered, not only the small
    // icon inside it. Reduced motion is honoured by the icons themselves.
    useEffect(() => {
      const span = anchor.current;
      const target = span?.parentElement?.closest<HTMLElement>(HOVER_TARGET) ?? span;
      if (!target) return;
      const start = () => handle.current?.startAnimation();
      const stop = () => handle.current?.stopAnimation();
      target.addEventListener('pointerenter', start);
      target.addEventListener('pointerleave', stop);
      return () => {
        target.removeEventListener('pointerenter', start);
        target.removeEventListener('pointerleave', stop);
      };
    }, []);

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
export const ChartPieIcon = make(H.PieChart01Icon);
export const ChartAreaIcon = make(H.ChartAreaIcon);
export const TrendingUpIcon = make(H.ChartUpIcon);
export const TrendingDownIcon = make(H.ChartDownIcon);
export const ArrowUpIcon = make(H.ArrowUp01Icon);
export const ArrowDownIcon = make(H.ArrowDown01Icon);
export const MinusIcon = make(H.MinusIcon);
export const FilePlus2Icon = animated(AnimatedFileAddIcon);
export const MessageCircleQuestionIcon = make(H.MessageQuestionIcon);
export const DownloadIcon = animated(AnimatedDownloadIcon);
export const UploadIcon = animated(AnimatedUpload01Icon);
export const CameraIcon = animated(AnimatedCamera01Icon);
export const ActivityIcon = animated(AnimatedActivityIcon);
export const UserPlusIcon = animated(AnimatedUserAdd01Icon);
export const PencilLineIcon = make(H.PencilEdit02Icon);
export const SendIcon = make(H.Sent02Icon);

// Rich text editor (bare, unsuffixed names as the editor imports them)
export const Bold = make(H.BoldIcon);
export const Code = animated(AnimatedCodeIcon);
export const Heading1 = make(H.Heading01Icon);
export const Heading2 = make(H.Heading02Icon);
export const Heading3 = make(H.Heading03Icon);
export const Heading4 = make(H.Heading04Icon);
export const Heading5 = make(H.Heading05Icon);
export const Heading6 = make(H.Heading06Icon);
export const Highlighter = make(H.HighlighterIcon);
export const Italic = make(H.ItalicIcon);
export const Link = animated(AnimatedLink01Icon);
export const Link2Off = make(H.Unlink01Icon);
export const List = make(H.ListIcon);
export const ListOrdered = make(H.ListOrderedIcon);
export const Minus = make(H.MinusIcon);
export const Redo2 = animated(AnimatedRedoIcon);
export const RemoveFormatting = make(H.RemoveFormattingIcon);
export const SquareCode = make(H.SourceCodeSquareIcon);
export const Strikethrough = make(H.StrikethroughIcon);
export const Subscript = make(H.SubscriptIcon);
export const Superscript = make(H.SuperscriptIcon);
export const TextAlignCenter = animated(AnimatedTextAlignCenterIcon);
export const TextAlignEnd = make(H.TextAlignEndIcon);
export const TextAlignJustify = animated(AnimatedTextAlignJustifyIcon);
export const TextAlignStart = make(H.TextAlignStartIcon);
export const TextQuote = make(H.QuoteDownIcon);
export const Underline = make(H.UnderlineIcon);
export const Undo2 = make(H.ArrowTurnBackwardIcon);
export const Image = animated(AnimatedImage01Icon);
export const Upload = animated(AnimatedUpload01Icon);
export const AlignCenter = animated(AnimatedTextAlignCenterIcon);
export const AlignLeft = animated(AnimatedTextAlignLeftIcon);
export const AlignRight = animated(AnimatedTextAlignRightIcon);
export const AlignJustify = animated(AnimatedTextAlignJustifyIcon);
export const Copy = animated(AnimatedCopyIcon);
export const Maximize2 = make(H.Maximize02Icon);
export const MoreHorizontal = animated(AnimatedMoreHorizontalIcon);
export const Trash2 = animated(AnimatedDelete02Icon);
export const MoreVertical = animated(AnimatedMoreVerticalIcon);
export const Plus = animated(AnimatedAdd01Icon);
export const ArrowRight = make(H.ArrowRight01Icon);
export const ArrowLeft = make(H.ArrowLeft01Icon);
export const ArrowUp = make(H.ArrowUp01Icon);
export const ArrowDown = make(H.ArrowDown01Icon);
export const GridIcon = make(H.Grid3x3Icon);
export const Keyboard = animated(AnimatedKeyboardIcon);
export const Ban = animated(AnimatedCancelCircleIcon);
export const Baseline = make(H.BaselineIcon);
export const ChevronDown = animated(AnimatedChevronDownIcon);
export const Code2 = make(H.CodeSquareIcon);
export const IndentDecrease = animated(AnimatedTextIndentLessIcon);
export const IndentIncrease = animated(AnimatedTextIndentMoreIcon);
export const ListTodo = make(H.ListChecksIcon);
export const Quote = make(H.QuoteUpIcon);
export const Table = animated(AnimatedTableIcon);
export const TableIcon = animated(AnimatedTableIcon);

// Shared UI ("Icon"-suffixed names)
export const CalendarClockIcon = make(H.CalendarClockIcon);
export const FileTextIcon = make(H.FileTextIcon);
export const GlobeIcon = animated(AnimatedGlobe02Icon);
export const CheckIcon = make(H.Tick02Icon);
export const ChevronUpIcon = animated(AnimatedChevronUpIcon);
export const ChevronDownIcon = animated(AnimatedChevronDownIcon);
export const ChevronLeftIcon = animated(AnimatedChevronLeftIcon);
export const ChevronRightIcon = animated(AnimatedChevronRightIcon);
export const EyeIcon = make(H.ViewIcon);
export const EyeOffIcon = make(H.ViewOffIcon);
export const FolderIcon = animated(AnimatedFolder01Icon);
export const LinkIcon = animated(AnimatedLink01Icon);
export const PlusIcon = animated(AnimatedAdd01Icon);
export const TagIcon = animated(AnimatedTag01Icon);
export const Trash2Icon = animated(AnimatedDelete02Icon);
export const Undo2Icon = make(H.ArrowTurnBackwardIcon);
export const UserIcon = animated(AnimatedUserIcon);
export const CircleAlertIcon = animated(AnimatedAlertCircleIcon);
export const ExternalLinkIcon = make(H.ExternalLinkIcon);
export const MoreHorizontalIcon = animated(AnimatedMoreHorizontalIcon);
export const PanelRightIcon = animated(AnimatedSidebarRightIcon);
export const PencilIcon = make(H.PencilEdit01Icon);
export const RotateCcwIcon = make(H.ArrowTurnBackwardIcon);
export const SearchIcon = animated(AnimatedSearchIcon);
export const SearchXIcon = make(H.SearchRemoveIcon);
export const XIcon = animated(AnimatedCancel01Icon);
export const ArrowRightIcon = make(H.ArrowRight01Icon);
export const ArchiveIcon = make(H.Archive01Icon);
export const LayoutDashboardIcon = make(H.DashboardSquare01Icon);
export const PanelLeftIcon = animated(AnimatedSidebarLeftIcon);
export const KeyboardIcon = animated(AnimatedKeyboardIcon);
export const LogOutIcon = animated(AnimatedLogout01Icon);
export const BellIcon = animated(AnimatedNotificationIcon);
export const CircleCheckIcon = make(H.CircleCheckIcon);
export const InfoIcon = animated(AnimatedInformationCircleIcon);
export const TriangleAlertIcon = make(H.TriangleAlertIcon);
export const CopyIcon = animated(AnimatedCopyIcon);
export const MegaphoneIcon = animated(AnimatedMegaphone01Icon);
export const OctagonXIcon = make(H.OctagonXIcon);
export const LoaderIcon = animated(AnimatedLoading02Icon);
export const ArrowRightLeft = make(H.ArrowDataTransferHorizontalIcon);
export const CircleHelp = animated(AnimatedHelpCircleIcon);
export const ExternalLink = make(H.ExternalLinkIcon);
export const FileText = make(H.FileTextIcon);
export const ImageIcon = animated(AnimatedImage01Icon);
export const LayoutDashboard = make(H.DashboardSquare01Icon);
export const Settings = animated(AnimatedSettings01Icon);
export const UserCog = animated(AnimatedUserSettings01Icon);
export const Users = animated(AnimatedUserGroupIcon);
export const UsersIcon = animated(AnimatedUserGroupIcon);
export const FileQuestionIcon = make(H.FileQuestionMarkIcon);
export const MailCheck = animated(AnimatedMailCheckIcon);
export const MessageSquareQuoteIcon = make(H.MessageSquareQuoteIcon);
export const StarIcon = animated(AnimatedStarIcon);
export const CircleHelpIcon = animated(AnimatedHelpCircleIcon);
export const FolderPlusIcon = animated(AnimatedFolderAddIcon);
export const MailIcon = animated(AnimatedMail01Icon);
export const SunMoonIcon = make(H.SunMoonIcon);
