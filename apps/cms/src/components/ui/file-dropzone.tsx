'use client';

// Ported from the uiarc file dropzone onto our tokens, icons and Tailwind; the parts Tailwind
// can't say neatly (the drawn edge, the fanning sheets, the drag glow) are under
// [data-slot='file-dropzone'] in styles.css. `DropTarget` is the prompt alone, for places that
// handle the file themselves; `FileDropzone` adds a row per file with its upload's progress.
import * as React from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import type { HTMLMotionProps, TargetAndTransition, Transition } from 'motion/react';
import {
  AlertCircleIcon,
  FileTypeArchiveIcon,
  FileTypeCsvIcon,
  FileTypeDocIcon,
  FileTypeIcon,
  FileTypeImageIcon,
  FileTypePdfIcon,
  FileTypeVideoIcon,
  RemoveFileIcon,
  RetryIcon,
  UploadArrowIcon,
} from '@/components/icons';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type FileDropzoneStatus = 'uploading' | 'uploaded' | 'failed';
/** One row in the list. A row without a status is a plain selection. */
export type FileDropzoneItem = {
  id: string;
  name: string;
  size: number;
  status?: FileDropzoneStatus;
  progress?: number;
  error?: string;
  retryable?: boolean;
  file?: File;
  /** A thumbnail URL; images added here get one automatically. */
  preview?: string;
};
/**
 * Report 0 to 100 through onProgress, resolve when the file lands, or throw an Error whose
 * message becomes the row's reason. Removing the row aborts the signal.
 */
export type FileDropzoneUpload = (
  item: FileDropzoneItem,
  options: { onProgress: (percent: number) => void; signal: AbortSignal }
) => Promise<void>;

type Bezier = [number, number, number, number];
const easeEnter: Bezier = [0.16, 1, 0.3, 1];
const easeStandard: Bezier = [0.4, 0, 0.2, 1];
const smooth: Transition = { type: 'spring', visualDuration: 0.35, bounce: 0 };
const snappy: Transition = { type: 'spring', visualDuration: 0.22, bounce: 0.15 };
const enter: Transition = { duration: 0.24, ease: easeEnter };
const exitFast: Transition = { duration: 0.15, ease: easeStandard };
const instant: Transition = { duration: 0 };
const fade: Transition = { duration: 0.1 };
const textIn: TargetAndTransition = { opacity: 0, y: '0.3em', filter: 'blur(4px)' };
const textOut: TargetAndTransition = {
  opacity: 0,
  y: '-0.3em',
  filter: 'blur(2px)',
  transition: exitFast,
};
const shown: TargetAndTransition = { opacity: 1, y: '0em', filter: 'blur(0px)' };
/** A short, decaying side-to-side shake: "no" without moving anything else. */
const SHAKE = { x: [0, -7, 6, -4, 3, -1.5, 0] };
const shakeTransition: Transition = { duration: 0.42, ease: 'easeOut' };
/** The dash and gap of the drawn edge, in px; the edge's length is fitted to a whole number. */
const PERIOD = 7;
const MB = 1024 * 1024;
const clamp = (value: number) => Math.min(Math.max(value, 0), 100);

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / MB;
  return `${mb >= 10 ? Math.round(mb) : Number(mb.toFixed(1))} MB`;
}

/** Whether a file fits an `accept` list such as ".docx,image/*,text/csv". */
export function matchesAccept(file: File, accept?: string) {
  const types =
    accept
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? [];
  if (types.length === 0) return true;
  return types.some((type) =>
    type.startsWith('.')
      ? file.name.toLowerCase().endsWith(type)
      : type.endsWith('/*')
        ? file.type.startsWith(type.slice(0, -1))
        : file.type === type
  );
}

function TypeIcon({ name }: { name: string }) {
  const extension = name.toLowerCase().split('.').pop() ?? '';
  const Icon = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'heic'].includes(extension)
    ? FileTypeImageIcon
    : ['mov', 'mp4', 'webm', 'm4v', 'avi'].includes(extension)
      ? FileTypeVideoIcon
      : ['zip', 'gz', 'tar', 'rar', '7z'].includes(extension)
        ? FileTypeArchiveIcon
        : extension === 'pdf'
          ? FileTypePdfIcon
          : extension === 'csv'
            ? FileTypeCsvIcon
            : ['doc', 'docx', 'rtf', 'txt', 'md'].includes(extension)
              ? FileTypeDocIcon
              : FileTypeIcon;
  return <Icon aria-hidden className="size-5" />;
}

/** Outgoing copies are hidden from assistive tech while they leave, so only the current text is read. */
function Swap(props: HTMLMotionProps<'span'>) {
  const present = useIsPresent();
  return <motion.span {...props} aria-hidden={present ? props['aria-hidden'] : true} />;
}

/** The new text rises into place and unblurs while the old one lifts away, in the same slot. */
function TextSwap({
  text,
  className,
  reduce,
}: {
  text: string;
  className?: string;
  reduce: boolean;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <Swap
        key={text}
        className={className}
        initial={reduce ? { opacity: 0 } : textIn}
        animate={shown}
        exit={reduce ? { opacity: 0, transition: fade } : textOut}
        transition={reduce ? fade : enter}
      >
        {text}
      </Swap>
    </AnimatePresence>
  );
}

/** The refusal under the target. It opens on a spring and follows its copy's measured height. */
function ErrorRow({ text, reduce }: { text: string; reduce: boolean }) {
  const copyRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | 'auto'>('auto');
  React.useEffect(() => {
    const node = copyRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      className="overflow-hidden"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height, opacity: 1 }}
      exit={{
        height: 0,
        opacity: 0,
        transition: reduce ? instant : { height: smooth, opacity: fade },
      }}
      transition={reduce ? instant : { height: smooth, opacity: { duration: 0.15 } }}
    >
      <div
        ref={copyRef}
        role="alert"
        className="text-destructive text-ui flex items-start gap-1.5 pt-2.5"
      >
        <AlertCircleIcon aria-hidden className="mt-0.75 size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">{text}</span>
      </div>
    </motion.div>
  );
}

/** The circle closes, then the tick draws through it. */
function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg
      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.path
        d="M12 2.5a9.5 9.5 0 1 1 0 19a9.5 9.5 0 1 1 0-19"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={enter}
      />
      <motion.path
        d="m8.2 12.4 2.6 2.6 5-5.2"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ ...enter, delay: 0.16 }}
      />
    </svg>
  );
}

function Thumb({ item }: { item: FileDropzoneItem }) {
  const [broken, setBroken] = React.useState(false);
  if (!item.preview || broken)
    return (
      <span
        data-part="file-thumb"
        className="text-muted-foreground grid size-10 place-items-center"
      >
        <TypeIcon name={item.name} />
      </span>
    );
  return (
    <span
      data-part="file-thumb"
      className="bg-muted block size-10 overflow-hidden rounded-md ring-1 ring-black/5 ring-inset"
    >
      <img
        src={item.preview}
        alt=""
        width={40}
        height={40}
        decoding="async"
        className="size-full object-cover"
        onError={() => setBroken(true)}
      />
    </span>
  );
}

const rowButtonClass =
  'outline-none transition-[background-color,color,border-color,scale] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-97 motion-reduce:transition-none motion-reduce:active:scale-100';

type RowProps = {
  item: FileDropzoneItem;
  reduce: boolean;
  delay: number;
  fresh: boolean;
  canRetry: boolean;
  onRemove: () => void;
  onRetry: () => void;
  removeRef: (node: HTMLButtonElement | null) => void;
};

function FileRow({ item, reduce, delay, fresh, canRetry, onRemove, onRetry, removeRef }: RowProps) {
  const { status } = item;
  const rowRef = React.useRef<HTMLDivElement>(null);
  // A failure shakes the row once: a file refused on arrival after it lands, an upload when it fails.
  const shakenFor = React.useRef<FileDropzoneStatus | 'new' | undefined>(fresh ? 'new' : status);
  React.useEffect(() => {
    const previous = shakenFor.current;
    if (status === previous) return;
    shakenFor.current = status;
    const node = rowRef.current;
    if (status !== 'failed' || reduce || !node) return;
    animate(node, SHAKE, { ...shakeTransition, delay: previous === 'new' ? delay + 0.3 : 0 });
  }, [status, reduce, delay]);

  // One spring drives the bar and the counted percentage, so both always agree.
  const progress = useMotionValue(status === 'uploaded' ? 100 : (item.progress ?? 0));
  const x = useTransform(progress, (value) => `${clamp(value) - 100}%`);
  const percent = useTransform(progress, (value) => `${Math.round(clamp(value))}%`);
  // A finished upload keeps its bar until the spring arrives, so 100% shows before "Uploaded".
  const [filled, setFilled] = React.useState(status !== 'uploading');
  const [seen, setSeen] = React.useState(status);
  if (seen !== status) {
    setSeen(status);
    if (status === 'uploading') setFilled(false);
  }
  const phase = status === 'uploaded' && !filled && !reduce ? 'uploading' : status;
  const target = status === 'uploaded' ? 100 : (item.progress ?? 0);
  React.useEffect(() => {
    if (status !== 'uploading' && status !== 'uploaded') return;
    // Every upload starts from an empty bar, even a retry that failed halfway.
    if (reduce || (status === 'uploading' && target === 0)) {
      progress.jump(target);
      return;
    }
    const controls = animate(progress, target, {
      ...smooth,
      onComplete: status === 'uploaded' ? () => setFilled(true) : undefined,
    });
    return () => controls.stop();
  }, [status, target, progress, reduce]);
  // The label turns as soon as the count reads 100%, not after the spring's last fraction.
  useMotionValueEvent(progress, 'change', (value) => {
    if (status === 'uploaded' && value >= 99.5) setFilled(true);
  });
  const failed = status === 'failed';
  const retry = failed && canRetry && item.retryable !== false;

  return (
    <motion.li
      className="min-w-0 overflow-hidden"
      initial={reduce ? { opacity: 0 } : { height: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={
        reduce
          ? { opacity: 0, transition: fade }
          : {
              height: 0,
              opacity: 0,
              transition: { height: smooth, opacity: { ...exitFast, delay: 0.04 } },
            }
      }
      transition={reduce ? fade : { height: { ...smooth, delay }, opacity: fade }}
    >
      {/* New rows drop out of the target and unblur while their height opens. */}
      <motion.div
        ref={rowRef}
        data-part="row"
        data-failed={failed || undefined}
        className="bg-background data-failed:border-destructive/30 relative mt-2 grid min-h-14.5 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border py-2 pr-2 pl-2.5 transition-colors"
        initial={reduce ? false : { opacity: 0, y: -22, scale: 0.94, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={reduce ? undefined : { scale: 0.97, filter: 'blur(2px)', transition: exitFast }}
        transition={
          reduce
            ? instant
            : {
                y: { ...smooth, delay },
                scale: { ...smooth, delay },
                opacity: { ...enter, delay },
                filter: { ...enter, delay },
              }
        }
      >
        <Thumb item={item} />
        <span className="grid min-w-0">
          <span className="text-ui truncate font-medium" title={item.name}>
            {item.name}
          </span>
          <span className="text-muted-foreground mt-px flex min-w-0 items-center text-xs whitespace-nowrap tabular-nums">
            <span>{formatFileSize(item.size)}</span>
            {phase && (
              <>
                <span aria-hidden className="px-1.5">
                  ·
                </span>
                <span className="relative flex min-w-0 flex-1">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <Swap
                      key={phase}
                      className={cn(
                        'inline-flex min-w-0 items-center gap-1.25',
                        phase === 'failed' && 'text-destructive'
                      )}
                      initial={reduce ? { opacity: 0 } : textIn}
                      animate={shown}
                      exit={reduce ? { opacity: 0, transition: fade } : textOut}
                      transition={reduce ? fade : enter}
                    >
                      {phase === 'uploading' ? (
                        <span>
                          Uploading <motion.span className="tabular-nums">{percent}</motion.span>
                        </span>
                      ) : phase === 'uploaded' ? (
                        <>
                          <DrawnCheck reduce={reduce} />
                          <span>Uploaded</span>
                        </>
                      ) : (
                        <>
                          <AlertCircleIcon aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate" title={item.error}>
                            <span className="sr-only">Failed: </span>
                            {item.error || 'Upload failed'}
                          </span>
                        </>
                      )}
                    </Swap>
                  </AnimatePresence>
                </span>
              </>
            )}
          </span>
          {/* The bar opens with the upload, fills on a spring, then folds away after the tick. */}
          <AnimatePresence initial={false}>
            {phase === 'uploading' && (
              <motion.span
                key="bar"
                className="block overflow-hidden"
                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={
                  reduce
                    ? { opacity: 0, transition: fade }
                    : {
                        height: 0,
                        opacity: 0,
                        transition: {
                          height: { ...smooth, delay: 0.22 },
                          opacity: { ...exitFast, delay: 0.16 },
                        },
                      }
                }
                transition={reduce ? fade : { height: smooth, opacity: enter }}
              >
                <span
                  role="progressbar"
                  aria-label={`Uploading ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(clamp(target))}
                  className="bg-muted mt-1.75 mb-0.5 block h-1 overflow-hidden rounded-full"
                >
                  {/* Slides in rather than scaling, so its rounded end keeps its shape. */}
                  <motion.span
                    className="bg-primary block size-full rounded-[inherit]"
                    style={{ x }}
                  />
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="flex items-center">
          {/* Retry opens its own width, so the name column narrows on a spring. */}
          <AnimatePresence initial={false}>
            {retry && (
              <motion.span
                key="retry"
                className="flex overflow-hidden"
                initial={reduce ? { opacity: 0 } : { width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={
                  reduce
                    ? { opacity: 0, transition: fade }
                    : { width: 0, opacity: 0, transition: { width: smooth, opacity: fade } }
                }
                transition={reduce ? fade : { width: smooth, opacity: enter }}
              >
                <motion.span
                  className="flex py-0.75 pr-1.5 pl-0.75"
                  initial={reduce ? false : { scale: 0.8, filter: 'blur(2px)' }}
                  animate={{ scale: 1, filter: 'blur(0px)' }}
                  transition={reduce ? instant : snappy}
                >
                  <button
                    type="button"
                    data-part="retry"
                    onClick={onRetry}
                    aria-label={`Retry ${item.name}`}
                    title="Retry"
                    className={cn(
                      rowButtonClass,
                      'bg-background pointer-fine:hover:bg-muted flex h-7.5 items-center gap-1.25 rounded-full pr-3 pl-2.5 text-xs font-medium whitespace-nowrap'
                    )}
                  >
                    <RetryIcon aria-hidden className="size-3.5" />
                    <span data-part="retry-label">Retry</span>
                  </button>
                </motion.span>
              </motion.span>
            )}
          </AnimatePresence>
          <button
            ref={removeRef}
            type="button"
            data-part="remove"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            title="Remove"
            className={cn(
              rowButtonClass,
              'text-muted-foreground pointer-fine:hover:bg-muted pointer-fine:hover:text-foreground touch:size-11 grid size-8 place-items-center rounded-full'
            )}
          >
            <RemoveFileIcon aria-hidden className="size-4" />
          </button>
        </span>
      </motion.div>
    </motion.li>
  );
}

export type DropTargetProps = {
  /** For the trigger, so a field's label can point at it. */
  id?: string;
  /** File types, as for an input: ".docx,image/png,image/*". */
  accept?: string;
  multiple?: boolean;
  /**
   * The files that fit `accept` (only the first unless `multiple`). Return a sentence to refuse
   * them: it shows under the target, and the target shakes.
   */
  onFiles: (files: File[]) => string | void;
  /** Shown when a file's type is not accepted. */
  refusal?: string;
  /** Working on a file: the target waits and shows `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  label?: string;
  /** The line under the label; null leaves it out. */
  description?: string | null;
  /** The small line under the description; null leaves it out. */
  note?: string | null;
  /** The label while files hover over the target. */
  dropLabel?: string;
  /** Folds the prompt to a slim bar; a file dragged over brings the sheets back. */
  compact?: boolean;
  /** More actions under the prompt, such as picking from Media. */
  children?: React.ReactNode;
  /** Rows drawn inside the edge, below the prompt. */
  inside?: React.ReactNode;
  /** Rows drawn under the target. */
  below?: React.ReactNode;
  /** Whether `inside` holds any rows, so the prompt can make room. */
  hasRowsInside?: boolean;
  /** For the target itself, such as a minimum height. */
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
};

/**
 * The drop target: a drawn dashed edge that closes into a solid line under a file, light that
 * follows the pointer, three sheets that fan open, and paste while the pointer or focus is on it.
 * Clicking anywhere on it opens the file chooser.
 */
export function DropTarget({
  id,
  accept,
  multiple = false,
  onFiles,
  refusal,
  busy = false,
  busyLabel = 'Uploading',
  label = multiple ? 'Add files' : 'Add a file',
  description = 'Drop here or choose from your device',
  note,
  dropLabel = multiple ? 'Drop to add them' : 'Drop to add it',
  compact = false,
  children,
  inside,
  below,
  hasRowsInside = false,
  className,
  ref,
}: DropTargetProps) {
  const reduce = !!useReducedMotion();
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState('');
  const [hovered, setHovered] = React.useState(false);
  const [focusWithin, setFocusWithin] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const zoneRef = React.useRef<HTMLDivElement>(null);
  const edgeRef = React.useRef<SVGRectElement>(null);
  const dragDepth = React.useRef(0);
  const descriptionId = React.useId();
  const noteId = React.useId();

  // The glow follows the pointer on a spring, so the outline leans toward the file.
  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(50);
  const glowSpring = { stiffness: 260, damping: 32, mass: 0.8 };
  const glowX = useSpring(pointerX, glowSpring);
  const glowY = useSpring(pointerY, glowSpring);
  const edgeLight = useMotionTemplate`radial-gradient(180px circle at ${glowX}% ${glowY}%, var(--primary), transparent 70%)`;
  const washLight = useMotionTemplate`radial-gradient(260px circle at ${glowX}% ${glowY}%, color-mix(in oklab, var(--primary) 7%, transparent), transparent 70%)`;
  const track = (event: React.DragEvent) => {
    const zone = zoneRef.current;
    if (!zone) return;
    const box = zone.getBoundingClientRect();
    const x = ((event.clientX - box.left) / Math.max(1, box.width)) * 100;
    const y = ((event.clientY - box.top) / Math.max(1, box.height)) * 100;
    if (reduce || !dragging) {
      pointerX.jump(x);
      pointerY.jump(y);
      glowX.jump(x);
      glowY.jump(y);
    } else {
      pointerX.set(x);
      pointerY.set(y);
    }
  };

  const refuse = (message: string) => {
    setError(message);
    if (!reduce && zoneRef.current) animate(zoneRef.current, SHAKE, shakeTransition);
  };

  function take(incoming: FileList | File[]) {
    if (busy) return;
    const list = Array.from(incoming);
    const matching = list.filter((file) => matchesAccept(file, accept));
    if (matching.length === 0) {
      refuse(
        refusal ??
          (list.length === 1
            ? `${list[0]!.name} is not a file this takes.`
            : 'None of those are files this takes.')
      );
      return;
    }
    const answer = onFiles(multiple ? matching : matching.slice(0, 1));
    if (answer) refuse(answer);
    else if (matching.length < list.length)
      refuse(refusal ?? 'Some files were left out because this does not take their type.');
    else setError('');
  }

  // The edge is drawn, not bordered, so its dashes can close into a solid line. Its length is
  // fitted to the measured perimeter, so every dash is the same size and the seam never shows.
  React.useLayoutEffect(() => {
    const zone = zoneRef.current;
    const edge = edgeRef.current;
    if (!zone || !edge) return;
    const fit = () => {
      const width = zone.offsetWidth - 1;
      const height = zone.offsetHeight - 1;
      const radius = Math.max(
        0,
        Math.min(
          parseFloat(getComputedStyle(zone).borderTopLeftRadius) - 0.5,
          width / 2,
          height / 2
        )
      );
      const perimeter = 2 * (width + height) - 8 * radius + 2 * Math.PI * radius;
      edge.setAttribute('rx', String(radius));
      edge.setAttribute('pathLength', String(Math.max(8, Math.round(perimeter / PERIOD)) * PERIOD));
    };
    fit();
    // Folding eases the corner radius too, so the edge follows every frame of that transition.
    let frame = 0;
    const follow = () => {
      fit();
      frame = requestAnimationFrame(follow);
    };
    const isRadius = (event: TransitionEvent) =>
      event.target === zone && event.propertyName.includes('radius');
    const onRun = (event: TransitionEvent) => {
      if (!isRadius(event)) return;
      cancelAnimationFrame(frame);
      follow();
    };
    const onEnd = (event: TransitionEvent) => {
      if (!isRadius(event)) return;
      cancelAnimationFrame(frame);
      fit();
    };
    zone.addEventListener('transitionrun', onRun);
    zone.addEventListener('transitionend', onEnd);
    zone.addEventListener('transitioncancel', onEnd);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit);
    observer?.observe(zone);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      zone.removeEventListener('transitionrun', onRun);
      zone.removeEventListener('transitionend', onEnd);
      zone.removeEventListener('transitioncancel', onEnd);
    };
  }, []);

  // Paste works while the pointer is over the target or focus is in it, so a screenshot on the
  // clipboard is one keystroke away.
  const pasteArmed = (hovered || focusWithin) && !busy;
  const takeRef = React.useRef(take);
  React.useLayoutEffect(() => {
    takeRef.current = take;
  });
  React.useEffect(() => {
    if (!pasteArmed) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (!files?.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input:not([type=file]), textarea, [contenteditable='true']")) return;
      event.preventDefault();
      takeRef.current(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [pasteArmed]);

  const carriesFiles = (event: React.DragEvent) =>
    !busy && Array.from(event.dataTransfer?.types ?? []).includes('Files');
  // Slots open and fold their own height, so the prompt changes shape on a spring.
  const slot = {
    initial: reduce ? { opacity: 0 } : { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: reduce
      ? { opacity: 0, transition: fade }
      : { height: 0, opacity: 0, transition: { height: smooth, opacity: exitFast } },
    transition: reduce ? fade : { height: smooth, opacity: enter },
  };
  const actions = React.Children.count(children) > 0;
  const showNote = !compact && note !== null && note !== undefined;
  const describedBy = [description !== null && descriptionId, showNote && noteId]
    .filter(Boolean)
    .join(' ');
  const shownLabel = busy ? busyLabel : dragging ? dropLabel : label;

  return (
    <div
      className="relative grid min-w-0"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocusWithin(false);
      }}
    >
      <div
        ref={zoneRef}
        data-slot="file-dropzone"
        data-dragging={dragging || undefined}
        data-compact={compact || undefined}
        data-busy={busy || undefined}
        className={cn(
          'relative flex min-w-0 flex-col rounded-xl data-compact:rounded-lg',
          className
        )}
        onDragEnter={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          if (!dragDepth.current) track(event);
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          track(event);
        }}
        onDragLeave={(event) => {
          if (!carriesFiles(event)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        }}
        onDrop={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          if (event.dataTransfer.files.length) take(event.dataTransfer.files);
        }}
      >
        <motion.span data-part="wash" aria-hidden style={{ backgroundImage: washLight }} />
        <svg data-part="edge" aria-hidden>
          <rect ref={edgeRef} width="100%" height="100%" rx={11.5} pathLength={1358} />
        </svg>
        <motion.span data-part="glow" aria-hidden style={{ backgroundImage: edgeLight }} />
        {/* Its children ignore the pointer, so the whole target is one place to click or drop. */}
        <motion.button
          ref={ref}
          id={id}
          type="button"
          data-part="trigger"
          disabled={busy}
          aria-describedby={describedBy || undefined}
          onClick={() => inputRef.current?.click()}
          className="focus-visible:ring-ring/50 flex w-full flex-1 cursor-pointer flex-col items-stretch justify-center rounded-[inherit] px-5 text-center outline-none *:pointer-events-none focus-visible:ring-[3px] disabled:cursor-default"
          initial={false}
          animate={{
            paddingTop: compact ? 14 : 22,
            paddingBottom: compact
              ? hasRowsInside || actions
                ? 8
                : 14
              : hasRowsInside
                ? 22
                : actions
                  ? 12
                  : 28,
          }}
          transition={reduce ? instant : smooth}
        >
          <AnimatePresence initial={false}>
            {(!compact || dragging) && (
              <motion.span key="icon" className="flex flex-col overflow-hidden" {...slot}>
                <span data-part="sheets" aria-hidden>
                  <span data-part="sheet" data-sheet="back" />
                  <span data-part="sheet" data-sheet="side" />
                  <span data-part="sheet" data-sheet="front">
                    {busy ? (
                      <Spinner aria-hidden className="size-3.5" />
                    ) : (
                      <UploadArrowIcon aria-hidden className="size-3.5" strokeWidth={2} />
                    )}
                  </span>
                </span>
              </motion.span>
            )}
          </AnimatePresence>
          <strong className="relative block text-xs font-medium">
            <TextSwap
              text={shownLabel}
              className="inline-block max-w-full truncate align-top"
              reduce={reduce}
            />
          </strong>
          {description !== null && (
            <span id={descriptionId} className="text-muted-foreground mt-1 text-xs">
              {description}
            </span>
          )}
          <AnimatePresence initial={false}>
            {showNote && (
              <motion.span key="note" className="flex flex-col overflow-hidden" {...slot}>
                <small id={noteId} className="text-muted-foreground/80 pt-1.5 text-xs">
                  {note}
                </small>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
        {actions && (
          <div className="relative flex flex-wrap justify-center gap-2 px-5 pb-5">{children}</div>
        )}
        {inside}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) take(event.target.files);
          event.target.value = '';
        }}
      />
      <AnimatePresence initial={false}>
        {error ? <ErrorRow key="error" text={error} reduce={reduce} /> : null}
      </AnimatePresence>
      {below}
    </div>
  );
}

export type FileDropzoneHandle = {
  /** Adds files as if they were dropped, such as ones dropped elsewhere on the page. */
  add: (files: File[]) => void;
};

export type FileDropzoneProps = Omit<
  DropTargetProps,
  'onFiles' | 'busy' | 'inside' | 'below' | 'hasRowsInside' | 'compact' | 'ref'
> & {
  maxFiles?: number;
  /** Files above this many bytes fail with a size reason and never upload. */
  maxSize?: number;
  /** Uploads each added file. Without it the list shows plain selections. */
  onUpload?: FileDropzoneUpload;
  onFilesChange?: (files: File[]) => void;
  /** Rows present at mount, such as files uploaded earlier. They show without an entrance. */
  defaultItems?: FileDropzoneItem[];
  /** The list under the target, or inside its edge. */
  listPlacement?: 'below' | 'inside';
  /** Once the list holds this many files, the prompt folds to a slim bar. */
  compactAt?: number;
  ref?: React.Ref<FileDropzoneHandle>;
};

/** The drop target with a row per file: its progress, a tick when it lands, or why it failed. */
export function FileDropzone({
  multiple = true,
  maxFiles = 20,
  maxSize,
  onUpload,
  onFilesChange,
  defaultItems,
  listPlacement = 'below',
  compactAt,
  accept,
  note,
  dropLabel,
  ref,
  ...target
}: FileDropzoneProps) {
  const reduce = !!useReducedMotion();
  const [items, setItems] = React.useState<FileDropzoneItem[]>(() => defaultItems ?? []);
  const [announcement, setAnnouncement] = React.useState('');
  // The first row of the latest batch, so only that batch staggers in.
  const [batchStart, setBatchStart] = React.useState(0);
  // Rows added here: only these fly in and shake when refused.
  const [freshIds, setFreshIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const nextId = React.useRef(0);
  const controllers = React.useRef(new Map<string, AbortController>());
  const removeRefs = React.useRef(new Map<string, HTMLButtonElement>());
  // Thumbnails made here are object URLs, released when their row goes or this unmounts.
  const ownedPreviews = React.useRef(new Map<string, string>());
  const inside = listPlacement === 'inside';
  const compact = compactAt !== undefined && items.length >= compactAt;

  React.useEffect(() => {
    const active = controllers.current;
    const previews = ownedPreviews.current;
    return () => {
      active.forEach((controller) => controller.abort());
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const filesOf = (list: FileDropzoneItem[]) =>
    list.flatMap((item) => (item.file ? [item.file] : []));
  const patch = (id: string, next: (item: FileDropzoneItem) => FileDropzoneItem) =>
    setItems((current) => current.map((item) => (item.id === id ? next(item) : item)));

  function startUpload(item: FileDropzoneItem) {
    if (!onUpload) return;
    controllers.current.get(item.id)?.abort();
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    patch(item.id, (current) => ({
      ...current,
      status: 'uploading',
      progress: 0,
      error: undefined,
    }));
    onUpload(
      { ...item, status: 'uploading', progress: 0, error: undefined },
      {
        signal: controller.signal,
        onProgress: (percent) => {
          if (controller.signal.aborted) return;
          patch(item.id, (current) =>
            current.status === 'uploading'
              ? { ...current, progress: Math.max(current.progress ?? 0, clamp(percent)) }
              : current
          );
        },
      }
    )
      .then(
        () => {
          if (controller.signal.aborted) return;
          patch(item.id, (current) => ({ ...current, status: 'uploaded', progress: 100 }));
          setAnnouncement(`${item.name} uploaded`);
        },
        (reason: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            reason instanceof Error && reason.message ? reason.message : 'Upload failed';
          patch(item.id, (current) => ({
            ...current,
            status: 'failed',
            error: message,
            retryable: true,
          }));
          setAnnouncement(`${item.name} failed. ${message}`);
        }
      )
      .finally(() => {
        if (controllers.current.get(item.id) === controller) controllers.current.delete(item.id);
      });
  }

  function addFiles(matching: File[]): string | void {
    const kept = multiple ? items : [];
    const same = (a: File, b: File) =>
      a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
    const fresh = matching.filter(
      (file, index) =>
        matching.findIndex((other) => same(other, file)) === index &&
        !kept.some((item) => item.file && same(item.file, file))
    );
    const room = multiple ? Math.max(0, maxFiles - kept.length) : 1;
    const added = fresh.slice(0, room).map((file): FileDropzoneItem => {
      const tooLarge = maxSize !== undefined && file.size > maxSize;
      const id = `${file.name}-${file.size}-${file.lastModified}-${nextId.current++}`;
      const preview =
        file.type.startsWith('image/') && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : undefined;
      if (preview) ownedPreviews.current.set(id, preview);
      return {
        id,
        name: file.name,
        size: file.size,
        file,
        preview,
        status: tooLarge ? 'failed' : onUpload ? 'uploading' : undefined,
        progress: 0,
        error: tooLarge ? `Larger than ${formatFileSize(maxSize)}` : undefined,
        retryable: !tooLarge,
      };
    });
    if (added.length) {
      if (!multiple) {
        controllers.current.forEach((controller) => controller.abort());
        controllers.current.clear();
      }
      const next = [...kept, ...added];
      setFreshIds((current) => new Set([...current, ...added.map((item) => item.id)]));
      setBatchStart(kept.length);
      setItems((current) => (multiple ? [...current, ...added] : added));
      onFilesChange?.(filesOf(next));
      const failed = added.filter((item) => item.status === 'failed');
      setAnnouncement(
        `${added.length} ${added.length === 1 ? 'file' : 'files'} added.${
          failed.length ? ` ${failed.map((item) => `${item.name}: ${item.error}`).join('. ')}.` : ''
        }`
      );
      added.filter((item) => item.status === 'uploading').forEach(startUpload);
    }
    if (fresh.length > added.length)
      return `You can add up to ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'} at a time.`;
  }

  const addRef = React.useRef(addFiles);
  React.useLayoutEffect(() => {
    addRef.current = addFiles;
  });
  React.useImperativeHandle(
    ref,
    () => ({
      add: (files) => {
        const matching = files.filter((file) => matchesAccept(file, accept));
        addRef.current(multiple ? matching : matching.slice(0, 1));
      },
    }),
    [accept, multiple]
  );

  // Focus stays in the list: the next row's remove button, else the previous one, else the target.
  function removeItem(target: FileDropzoneItem) {
    controllers.current.get(target.id)?.abort();
    controllers.current.delete(target.id);
    const index = items.findIndex((item) => item.id === target.id);
    const neighbour = items[index + 1] ?? items[index - 1];
    const next = items.filter((item) => item.id !== target.id);
    const preview = ownedPreviews.current.get(target.id);
    // The row keeps its thumbnail while it closes, then the URL is released.
    if (preview) {
      ownedPreviews.current.delete(target.id);
      window.setTimeout(() => URL.revokeObjectURL(preview), 600);
    }
    setItems((current) => current.filter((item) => item.id !== target.id));
    setAnnouncement(`${target.name} removed`);
    if (target.file) onFilesChange?.(filesOf(next));
    requestAnimationFrame(() =>
      (neighbour ? removeRefs.current.get(neighbour.id) : triggerRef.current)?.focus()
    );
  }

  // Retry leaves with the failure, so focus moves to the row's remove button.
  function retryItem(item: FileDropzoneItem) {
    setAnnouncement(`Retrying ${item.name}`);
    startUpload(item);
    requestAnimationFrame(() => removeRefs.current.get(item.id)?.focus());
  }

  // Up and down move between rows, keeping the same action. Delete or Backspace removes the row.
  function moveFocus(event: React.KeyboardEvent<HTMLUListElement>) {
    const button = (event.target as HTMLElement).closest('button');
    const row = button?.closest<HTMLElement>("[data-part='row']");
    if (!button || !row) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      row.querySelector<HTMLButtonElement>("[data-part='remove']")?.click();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-part='row']"));
    const nextRow = rows[rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (!nextRow) return;
    event.preventDefault();
    const part = button.dataset.part === 'retry' ? 'retry' : 'remove';
    (
      nextRow.querySelector<HTMLButtonElement>(`[data-part='${part}']`) ??
      nextRow.querySelector<HTMLButtonElement>("[data-part='remove']")
    )?.focus();
  }

  const list = (
    <motion.ul
      data-part="file-list"
      aria-label="Files"
      aria-hidden={items.length ? undefined : true}
      onKeyDown={moveFocus}
      className={cn('grid min-w-0', inside && 'relative px-3')}
      initial={false}
      // The list's own padding opens with the first row, so the gap never appears in one frame.
      animate={{
        paddingTop: items.length && !inside ? 4 : 0,
        paddingBottom: items.length && inside ? 12 : 0,
      }}
      transition={reduce ? instant : smooth}
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <FileRow
            key={item.id}
            item={item}
            reduce={reduce}
            delay={reduce ? 0 : Math.min(Math.max(0, index - batchStart), 7) * 0.05}
            fresh={freshIds.has(item.id)}
            canRetry={!!onUpload}
            onRemove={() => removeItem(item)}
            onRetry={() => retryItem(item)}
            removeRef={(node) => {
              if (node) removeRefs.current.set(item.id, node);
              else removeRefs.current.delete(item.id);
            }}
          />
        ))}
      </AnimatePresence>
    </motion.ul>
  );

  return (
    <>
      <DropTarget
        {...target}
        ref={triggerRef}
        accept={accept}
        multiple={multiple}
        onFiles={addFiles}
        compact={compact}
        note={note === undefined ? (accept ? null : `Up to ${maxFiles} at a time`) : note}
        dropLabel={dropLabel ?? (onUpload ? 'Drop to upload' : undefined)}
        inside={inside ? list : undefined}
        below={inside ? undefined : list}
        hasRowsInside={inside && items.length > 0}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
