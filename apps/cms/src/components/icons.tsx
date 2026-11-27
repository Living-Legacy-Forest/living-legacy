// Hugeicons, wrapped under the same names the app used for lucide-react, so
// call sites (`<FileTextIcon aria-hidden className="size-4" />`) don't change.
import * as H from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArchiveNavIcon,
  AreaNavIcon,
  ArrowDownNavIcon,
  ArrowLeftNavIcon,
  ArrowRightNavIcon,
  ArrowUpNavIcon,
  BanNavIcon,
  BellNavIcon,
  BrowserNavIcon,
  BubbleLinesNavIcon,
  CalendarNavIcon,
  CameraNavIcon,
  CheckCheckNavIcon,
  ChecklistNavIcon,
  ChevDownNavIcon,
  ChevLeftNavIcon,
  ChevRightNavIcon,
  ChevUpNavIcon,
  CircleAlertNavIcon,
  CircleCheckNavIcon,
  CopyNavIcon,
  CropNavIcon,
  DashboardNavIcon,
  DotsVNavIcon,
  DownloadNavIcon,
  EyeNavIcon,
  EyeOffNavIcon,
  FilePlusNavIcon,
  FileQuestionNavIcon,
  FingerprintNavIcon,
  FolderNavIcon,
  FolderPlusNavIcon,
  FullScreenNavIcon,
  GalleryNavIcon,
  GiftNavIcon,
  GlobeNavIcon,
  HelpNavIcon,
  InfoNavIcon,
  KeyNavIcon,
  KeyboardNavIcon,
  LaptopNavIcon,
  LayersNavIcon,
  LegalNavIcon,
  LinkNavIcon,
  LoaderNavIcon,
  LocateNavIcon,
  LogOutNavIcon,
  MailCheckNavIcon,
  MailNavIcon,
  MailOpenNavIcon,
  MegaphoneNavIcon,
  MinusNavIcon,
  MonitorNavIcon,
  MoonNavIcon,
  NewsNavIcon,
  OctagonXNavIcon,
  PageNavIcon,
  PaletteNavIcon,
  PanelLeftNavIcon,
  PanelRightNavIcon,
  PhoneNavIcon,
  PieNavIcon,
  PinNavIcon,
  PinOffNavIcon,
  PipetteNavIcon,
  PlugNavIcon,
  PulseNavIcon,
  PushPinNavIcon,
  QuoteNavIcon,
  RetryNavIcon,
  RouteNavIcon,
  SaveNavIcon,
  ScanQrNavIcon,
  SearchSwapNavIcon,
  SearchXNavIcon,
  SendNavIcon,
  ServerNavIcon,
  SettingsNavIcon,
  ShieldNavIcon,
  ShieldUserNavIcon,
  SparklesNavIcon,
  StarNavIcon,
  SunMoonNavIcon,
  SunNavIcon,
  SwapNavIcon,
  TabletNavIcon,
  TagNavIcon,
  TeamNavIcon,
  TickNavIcon,
  ToggleOffNavIcon,
  ToggleOnNavIcon,
  TrendDownNavIcon,
  TrendUpNavIcon,
  TriangleAlertNavIcon,
  UndoNavIcon,
  UploadArrowNavIcon,
  UploadNavIcon,
  UserCircleNavIcon,
  UserCogNavIcon,
  UserNavIcon,
  UserPlusNavIcon,
  VolumeNavIcon,
  VolumeOffNavIcon,
} from './nav-icons';
import {
  ArrowOutIcon,
  BarsIcon,
  BinIcon,
  CellsViewIcon,
  CrossMarkIcon,
  DotsIcon,
  FunnelIcon,
  KnobsIcon,
  LensIcon,
  PencilNibIcon,
  PlusMarkIcon,
  RowsViewIcon,
} from './view-icons';
import { useEffect, useRef } from 'react';
import { LeftToRightListBulletIcon as AnimatedLeftToRightListBulletIcon } from '@animateicons/react/huge/left-to-right-list-bullet-icon';
import { LinkOffIcon as AnimatedLinkOffIcon } from '@animateicons/react/huge/link-off-icon';
import { QuoteIcon as AnimatedQuoteIcon } from '@animateicons/react/huge/quote-icon';
import { cn } from '@/lib/utils';
import { ICON_STROKE, ICON_STROKE_ATTR } from './icon-stroke';
import { CheckIcon as DrawnCheckIcon } from './drawn-icons';

// @hugeicons/core-free-icons doesn't export its icon-data type, so derive it
// structurally from one of its own exports.
type IconData = typeof H.MinusIcon;

/** For icon-as-prop patterns (e.g. nav items), matching lucide's old `LucideIcon` type. */
export type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

function make(icon: IconData): LucideIcon {
  return function WrappedIcon({ strokeWidth, ...props }) {
    // Lucide's icons accepted a string|number strokeWidth; Hugeicons wants a number.
    if (strokeWidth === undefined) {
      return (
        <HugeiconsIcon icon={icon} strokeWidth={ICON_STROKE} {...ICON_STROKE_ATTR} {...props} />
      );
    }
    return <HugeiconsIcon icon={icon} strokeWidth={Number(strokeWidth)} {...props} />;
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
    // stroke is ICON_STROKE (the CSS fallback below repeats it) unless one is passed.
    const sized = /(^|\s)size-/.test(String(className ?? ''));
    return (
      <span ref={anchor} className="contents" {...(strokeWidth === undefined && ICON_STROKE_ATTR)}>
        <Icon
          ref={handle}
          {...(props as React.HTMLAttributes<HTMLDivElement>)}
          className={cn(
            'shrink-0 [&>svg]:[stroke-width:var(--icon-stroke,var(--icon-stroke-default,2))]',
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
export const ChartPieIcon = PieNavIcon;
export const ChartAreaIcon = AreaNavIcon;
// Plain arrows: beside a small figure, a boxed chart glyph reads as a blob.
export const TrendingUpIcon = TrendUpNavIcon;
export const TrendingDownIcon = TrendDownNavIcon;
export const ArrowUpIcon = ArrowUpNavIcon;
export const PinIcon = PushPinNavIcon;
export const PinOffIcon = PinOffNavIcon;
export const ArrowDownIcon = ArrowDownNavIcon;
export const MinusIcon = MinusNavIcon;
export const FilePlus2Icon = FilePlusNavIcon;
export const MessageCircleQuestionIcon = HelpNavIcon;
export const DownloadIcon = DownloadNavIcon;
export const UploadIcon = UploadNavIcon;
export const CameraIcon = CameraNavIcon;
export const ActivityIcon = PulseNavIcon;
export const UserPlusIcon = UserPlusNavIcon;
export const PencilLineIcon = PencilNibIcon;
export const SendIcon = SendNavIcon;

// Rich text editor (bare, unsuffixed names as the editor imports them)
export const Bold = make(H.TextBoldIcon);
export const Code = make(H.CodeIcon);
export const CropIcon = CropNavIcon;
export const LaptopIcon = LaptopNavIcon;
export const SunIcon = SunNavIcon;
export const MoonIcon = MoonNavIcon;
export const MonitorIcon = MonitorNavIcon;
export const SunMoonIcon = SunMoonNavIcon;
export const PaletteIcon = PaletteNavIcon;
// File types and actions for the file dropzone's rows.
export const FileTypeIcon = make(H.File02Icon);
export const FileTypeImageIcon = make(H.Image02Icon);
export const FileTypeVideoIcon = make(H.Video02Icon);
export const FileTypeArchiveIcon = make(H.Zip02Icon);
export const FileTypeDocIcon = make(H.Doc02Icon);
export const FileTypePdfIcon = make(H.Pdf02Icon);
export const FileTypeCsvIcon = make(H.Csv02Icon);
export const RetryIcon = RetryNavIcon;
export const SortIcon = BarsIcon;
export const UploadArrowIcon = UploadArrowNavIcon;
export const RemoveFileIcon = CrossMarkIcon;
export const AlertCircleIcon = CircleAlertNavIcon;
export const SmartphoneIcon = PhoneNavIcon;
export const TabletIcon = TabletNavIcon;
export const ToggleOnIcon = ToggleOnNavIcon;
export const ToggleOffIcon = ToggleOffNavIcon;
/** A breadcrumb separator: static, since it sits in every header. */
export const BreadcrumbChevronIcon = ChevRightNavIcon;
export const FullScreenIcon = FullScreenNavIcon;
export const UptimeIcon = ShieldNavIcon;
export const LocateIcon = LocateNavIcon;
export const Heading1 = make(H.Heading01Icon);
export const Heading2 = make(H.Heading02Icon);
export const Heading3 = make(H.Heading03Icon);
export const Heading4 = make(H.Heading04Icon);
export const Heading5 = make(H.Heading05Icon);
export const Heading6 = make(H.Heading06Icon);
export const Highlighter = make(H.Pen01Icon);
export const Italic = make(H.TextItalicIcon);
export const Link = make(H.Link01Icon);
export const Link2Off = animated(AnimatedLinkOffIcon);
export const List = animated(AnimatedLeftToRightListBulletIcon);
export const ListOrdered = make(H.LeftToRightListNumberIcon);
export const Minus = MinusNavIcon;
export const Redo2 = make(H.RedoIcon);
export const RemoveFormatting = make(H.RemoveFormattingIcon);
export const SquareCode = make(H.CodeSquareIcon);
export const Strikethrough = make(H.TextStrikethroughIcon);
export const Subscript = make(H.SubscriptIcon);
export const Superscript = make(H.SuperscriptIcon);
export const TextAlignCenter = make(H.TextAlignCenterIcon);
export const TextAlignEnd = make(H.TextAlignRightIcon);
export const TextAlignJustify = make(H.TextAlignJustifyCenterIcon);
export const TextAlignStart = make(H.TextAlignLeftIcon);
export const TextQuote = animated(AnimatedQuoteIcon);
export const Underline = make(H.TextUnderlineIcon);
export const Undo2 = make(H.UndoIcon);
export const AlignCenter = make(H.TextAlignCenterIcon);
export const AlignLeft = make(H.TextAlignLeftIcon);
export const AlignRight = make(H.TextAlignRightIcon);
export const AlignJustify = make(H.TextAlignJustifyCenterIcon);
export const MoreHorizontal = DotsIcon;
export const Trash2 = BinIcon;
export const MoreVertical = DotsVNavIcon;
export const Plus = PlusMarkIcon;
export const ArrowRight = ArrowRightNavIcon;
export const ArrowLeft = ArrowLeftNavIcon;
export const ArrowUp = ArrowUpNavIcon;
export const ArrowDown = ArrowDownNavIcon;
export const Keyboard = KeyboardNavIcon;
export const Ban = BanNavIcon;
export const Baseline = make(H.BaselineIcon);
export const ChevronDown = ChevDownNavIcon;
export const Code2 = make(H.CodeIcon);
export const IndentDecrease = make(H.TextIndentLessIcon);
export const IndentIncrease = make(H.TextIndentMoreIcon);
export const ListTodo = ChecklistNavIcon;
export const Quote = QuoteNavIcon;
export const Table = make(H.TableIcon);

// Shared UI ("Icon"-suffixed names)
// Calendar with a clock, whose hands turn: no fixed date printed on it.
export const CalendarClockIcon = CalendarNavIcon;
export const FileTextIcon = PageNavIcon;
export const GlobeIcon = GlobeNavIcon;
export const CheckIcon = DrawnCheckIcon;
/** The tick inside a checkbox: static, since it sits in every list row. */
export const CheckboxTickIcon = TickNavIcon;
export const SaveIcon = SaveNavIcon;
export const ScanQrIcon = ScanQrNavIcon;
export const ChevronUpIcon = ChevUpNavIcon;
export const ChevronDownIcon = ChevDownNavIcon;
export const ChevronLeftIcon = ChevLeftNavIcon;
export const ChevronRightIcon = ChevRightNavIcon;
export const EyeIcon = EyeNavIcon;
export const EyeOffIcon = EyeOffNavIcon;
export const FolderIcon = FolderNavIcon;
export const LinkIcon = LinkNavIcon;
export const PlusIcon = PlusMarkIcon;
export const TagIcon = TagNavIcon;
// The writing assistant's Suggest buttons.
export const SparklesIcon = SparklesNavIcon;
export const Trash2Icon = BinIcon;
// The rich-text editor's toolbar is pressed constantly while typing, so its icons stay still.
// These are the ones other screens also use in their animated form.
export const EditorList = make(H.LeftToRightListBulletIcon);
export const EditorLink2Off = make(H.UnlinkIcon);
export const EditorTextQuote = make(H.QuoteDownIcon);
export const EditorQuote = make(H.QuoteDownIcon);
export const EditorListTodo = make(H.CheckListIcon);
export const EditorPlus = make(H.Add01Icon);
export const EditorImage = make(H.Image01Icon);
export const Undo2Icon = UndoNavIcon;
export const UserIcon = UserNavIcon;
export const CircleAlertIcon = CircleAlertNavIcon;
export const ExternalLinkIcon = ArrowOutIcon;
export const MoreHorizontalIcon = DotsIcon;
export const PanelRightIcon = PanelRightNavIcon;
export const GridIcon = CellsViewIcon;
/** The list half of the list/grid switch: static, like the grid, so the pair matches. */
export const ListViewIcon = RowsViewIcon;
export const FilterIcon = FunnelIcon;
export const SlidersIcon = KnobsIcon;
export const PencilIcon = PencilNibIcon;
export const RotateCcwIcon = UndoNavIcon;
export const SearchIcon = LensIcon;
/** The same magnifier, still, for a toolbar button that should not move when pointed at. */
export const SearchStillIcon = LensIcon;
export const SearchXIcon = SearchXNavIcon;
// No animated search-and-replace drawing: the magnifier, which moves like the others.
export const SearchReplaceIcon = SearchSwapNavIcon;
export const XIcon = CrossMarkIcon;
export const ArrowRightIcon = ArrowRightNavIcon;
/** A straight arrow, where ArrowRightIcon is a chevron. */
export const ArrowForwardIcon = ArrowRightNavIcon;
export const ArchiveIcon = ArchiveNavIcon;
export const LayoutDashboardIcon = DashboardNavIcon;
export const PanelLeftIcon = PanelLeftNavIcon;
export const KeyboardIcon = KeyboardNavIcon;
export const KeyIcon = KeyNavIcon;
export const FingerprintIcon = FingerprintNavIcon;
export const IntegrationsIcon = PlugNavIcon;
export const SystemIcon = ServerNavIcon;
export const LogOutIcon = LogOutNavIcon;
export const BellIcon = BellNavIcon;
export const CheckCheckIcon = CheckCheckNavIcon;
export const PipetteIcon = PipetteNavIcon;
export const VolumeHighIcon = VolumeNavIcon;
export const VolumeOffIcon = VolumeOffNavIcon;
export const MailOpenIcon = MailOpenNavIcon;
export const LegalDocumentIcon = LegalNavIcon;
export const CircleCheckIcon = CircleCheckNavIcon;
export const InfoIcon = InfoNavIcon;
export const TriangleAlertIcon = TriangleAlertNavIcon;
export const CopyIcon = CopyNavIcon;
export const MegaphoneIcon = MegaphoneNavIcon;
/** What's new: a gift whose lid lifts, so it reads apart from Announcements' megaphone. */
export const GiftIcon = GiftNavIcon;
export const OctagonXIcon = OctagonXNavIcon;
export const LoaderIcon = LoaderNavIcon;
export const ArrowRightLeft = SwapNavIcon;
export const CircleHelp = HelpNavIcon;
export const ExternalLink = ArrowOutIcon;
export const FileText = PageNavIcon;
export const ImageIcon = GalleryNavIcon;
export const MediaIcon = GalleryNavIcon;
export const LayoutDashboard = DashboardNavIcon;
export const Settings = SettingsNavIcon;
export const UserCog = UserCogNavIcon;
export const Users = TeamNavIcon;
export const UsersIcon = TeamNavIcon;
export const FileQuestionIcon = FileQuestionNavIcon;
export const MailCheck = MailCheckNavIcon;
export const MessageSquareQuoteIcon = BubbleLinesNavIcon;
export const StarIcon = StarNavIcon;
export const CircleHelpIcon = HelpNavIcon;
export const FolderPlusIcon = FolderPlusNavIcon;
export const MailIcon = MailNavIcon;
export const MapPinIcon = PinNavIcon;
export const NewspaperIcon = NewsNavIcon;

// Analytics. Audience is a single person in a circle, as Team already has the group.
export const BrowserIcon = BrowserNavIcon;
export const RouteIcon = RouteNavIcon;
export const AudienceIcon = UserCircleNavIcon;
export const InboxIcon = MailIcon;

// Sidebar sections, in the rail.
export const ContentIcon = LayersNavIcon;
export const AdminIcon = ShieldUserNavIcon;
