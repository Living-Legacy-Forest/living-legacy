// Hugeicons, wrapped under the same names the app used for lucide-react, so
// call sites (`<FileTextIcon aria-hidden className="size-4" />`) don't change.
import * as H from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

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

// Dashboard & stats
export const ChartPieIcon = make(H.PieChart01Icon);
export const ChartAreaIcon = make(H.ChartAreaIcon);
export const TrendingUpIcon = make(H.ChartUpIcon);
export const TrendingDownIcon = make(H.ChartDownIcon);
export const ArrowUpIcon = make(H.ArrowUp01Icon);
export const ArrowDownIcon = make(H.ArrowDown01Icon);
export const MinusIcon = make(H.MinusIcon);
export const FilePlus2Icon = make(H.FileAddIcon);
export const MessageCircleQuestionIcon = make(H.MessageQuestionIcon);
export const UploadIcon = make(H.Upload01Icon);
export const UserPlusIcon = make(H.UserAdd01Icon);
export const PencilLineIcon = make(H.PencilEdit02Icon);
export const SendIcon = make(H.Sent02Icon);

// Rich text editor (bare, unsuffixed names as the editor imports them)
export const Bold = make(H.BoldIcon);
export const Code = make(H.CodeIcon);
export const Heading1 = make(H.Heading01Icon);
export const Heading2 = make(H.Heading02Icon);
export const Heading3 = make(H.Heading03Icon);
export const Heading4 = make(H.Heading04Icon);
export const Heading5 = make(H.Heading05Icon);
export const Heading6 = make(H.Heading06Icon);
export const Highlighter = make(H.HighlighterIcon);
export const Italic = make(H.ItalicIcon);
export const Link = make(H.Link01Icon);
export const Link2Off = make(H.Unlink01Icon);
export const List = make(H.ListIcon);
export const ListOrdered = make(H.ListOrderedIcon);
export const Minus = make(H.MinusIcon);
export const Redo2 = make(H.Redo02Icon);
export const RemoveFormatting = make(H.RemoveFormattingIcon);
export const SquareCode = make(H.SourceCodeSquareIcon);
export const Strikethrough = make(H.StrikethroughIcon);
export const Subscript = make(H.SubscriptIcon);
export const Superscript = make(H.SuperscriptIcon);
export const TextAlignCenter = make(H.TextAlignCenterIcon);
export const TextAlignEnd = make(H.TextAlignEndIcon);
export const TextAlignJustify = make(H.TextAlignJustifyIcon);
export const TextAlignStart = make(H.TextAlignStartIcon);
export const TextQuote = make(H.QuoteDownIcon);
export const Underline = make(H.UnderlineIcon);
export const Undo2 = make(H.ArrowTurnBackwardIcon);
export const Image = make(H.Image01Icon);
export const Upload = make(H.Upload01Icon);
export const AlignCenter = make(H.TextAlignCenterIcon);
export const AlignLeft = make(H.TextAlignLeftIcon);
export const AlignRight = make(H.TextAlignRightIcon);
export const AlignJustify = make(H.TextAlignJustifyIcon);
export const Copy = make(H.Copy01Icon);
export const Maximize2 = make(H.Maximize02Icon);
export const MoreHorizontal = make(H.MoreHorizontalIcon);
export const Trash2 = make(H.Delete02Icon);
export const MoreVertical = make(H.MoreVerticalIcon);
export const Plus = make(H.Add01Icon);
export const ArrowRight = make(H.ArrowRight01Icon);
export const ArrowLeft = make(H.ArrowLeft01Icon);
export const ArrowUp = make(H.ArrowUp01Icon);
export const ArrowDown = make(H.ArrowDown01Icon);
export const GridIcon = make(H.Grid3x3Icon);
export const Keyboard = make(H.KeyboardIcon);
export const Ban = make(H.CancelCircleIcon);
export const Baseline = make(H.BaselineIcon);
export const ChevronDown = make(H.ChevronDownIcon);
export const Code2 = make(H.CodeSquareIcon);
export const IndentDecrease = make(H.TextIndentLessIcon);
export const IndentIncrease = make(H.TextIndentMoreIcon);
export const ListTodo = make(H.ListChecksIcon);
export const Quote = make(H.QuoteUpIcon);
export const Table = make(H.Table01Icon);
export const TableIcon = make(H.Table01Icon);

// Shared UI ("Icon"-suffixed names)
export const CalendarClockIcon = make(H.CalendarClockIcon);
export const FileTextIcon = make(H.FileTextIcon);
export const GlobeIcon = make(H.GlobeIcon);
export const CheckIcon = make(H.Tick02Icon);
export const ChevronUpIcon = make(H.ChevronUpIcon);
export const ChevronDownIcon = make(H.ChevronDownIcon);
export const ChevronLeftIcon = make(H.ChevronLeftIcon);
export const ChevronRightIcon = make(H.ChevronRightIcon);
export const EyeIcon = make(H.ViewIcon);
export const EyeOffIcon = make(H.ViewOffIcon);
export const FolderIcon = make(H.Folder01Icon);
export const LinkIcon = make(H.Link01Icon);
export const PlusIcon = make(H.Add01Icon);
export const TagIcon = make(H.Tag01Icon);
export const Trash2Icon = make(H.Delete02Icon);
export const Undo2Icon = make(H.ArrowTurnBackwardIcon);
export const UserIcon = make(H.UserIcon);
export const CircleAlertIcon = make(H.AlertCircleIcon);
export const ExternalLinkIcon = make(H.ExternalLinkIcon);
export const MoreHorizontalIcon = make(H.MoreHorizontalIcon);
export const PanelRightIcon = make(H.SidebarRightIcon);
export const PencilIcon = make(H.PencilEdit01Icon);
export const RotateCcwIcon = make(H.ArrowTurnBackwardIcon);
export const SearchIcon = make(H.Search01Icon);
export const SearchXIcon = make(H.SearchRemoveIcon);
export const XIcon = make(H.Cancel01Icon);
export const ArrowRightIcon = make(H.ArrowRight01Icon);
export const ArchiveIcon = make(H.Archive01Icon);
export const LayoutDashboardIcon = make(H.DashboardSquare01Icon);
export const PanelLeftIcon = make(H.SidebarLeftIcon);
export const KeyboardIcon = make(H.KeyboardIcon);
export const LogOutIcon = make(H.Logout03Icon);
export const BellIcon = make(H.Notification01Icon);
export const CircleCheckIcon = make(H.CircleCheckIcon);
export const InfoIcon = make(H.InformationCircleIcon);
export const TriangleAlertIcon = make(H.TriangleAlertIcon);
export const OctagonXIcon = make(H.OctagonXIcon);
export const LoaderIcon = make(H.Loading02Icon);
export const ArrowRightLeft = make(H.ArrowDataTransferHorizontalIcon);
export const CircleHelp = make(H.HelpCircleIcon);
export const ExternalLink = make(H.ExternalLinkIcon);
export const FileText = make(H.FileTextIcon);
export const ImageIcon = make(H.Image01Icon);
export const LayoutDashboard = make(H.DashboardSquare01Icon);
export const Settings = make(H.Settings01Icon);
export const UserCog = make(H.UserSettings01Icon);
export const Users = make(H.UserGroupIcon);
export const UsersIcon = make(H.UserGroupIcon);
export const FileQuestionIcon = make(H.FileQuestionMarkIcon);
export const MailCheck = make(H.MailCheckIcon);
export const MessageSquareQuoteIcon = make(H.MessageSquareQuoteIcon);
export const StarIcon = make(H.StarIcon);
export const CircleHelpIcon = make(H.HelpCircleIcon);
export const FolderPlusIcon = make(H.FolderAddIcon);
export const MailIcon = make(H.MailIcon);
export const SunMoonIcon = make(H.SunMoonIcon);
