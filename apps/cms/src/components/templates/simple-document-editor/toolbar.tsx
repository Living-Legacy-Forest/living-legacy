'use client';

import { parseVideoUrl } from '@ll/content';
import { RichTextEditor } from '@/components/editor';
import type { Editor } from '@tiptap/react';
import {
  AlignLeft,
  Ban,
  ChevronDown,
  Code2,
  EditorImage as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  EditorListTodo as ListTodo,
  Minus,
  EditorPlus as Plus,
  EditorQuote as Quote,
  Table as TableIcon,
  FileTypeVideoIcon,
} from '@/components/icons';

import { MediaPicker } from '@/components/media/image-field';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { isEnterKey } from '@/lib/keyboard';
import { notify } from '@/lib/notify';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useState } from 'react';

import {
  ACTIVE_ITEM,
  ALIGNMENTS,
  CANVAS,
  HIGHLIGHTS,
  SCROLL_SHADOWS,
  TEXT_COLORS,
  TEXT_STYLES,
} from './constants';
import type { EditorSnapshot } from './utils';

const TextStyleMenu = ({ editor, value }: { editor: Editor | null; value: string }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button className="text-ui h-8 w-[6.5rem] justify-between px-2" size="sm" variant="ghost" />
      }
    >
      {TEXT_STYLES.find((s) => s.value === value)?.label}
      <ChevronDown className="text-muted-foreground size-3.5" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="min-w-32 p-1">
      <DropdownMenuRadioGroup
        className="flex flex-col gap-0.5"
        value={value}
        onValueChange={(next) => {
          const level = Number(next) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
          const chain = editor?.chain().focus();
          (level ? chain?.setHeading({ level }) : chain?.setParagraph())?.run();
        }}
      >
        {TEXT_STYLES.map((style) => (
          <DropdownMenuRadioItem
            key={style.value}
            className={cn(ACTIVE_ITEM, style.className)}
            value={style.value}
          >
            {style.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

const AlignMenu = ({ editor, value }: { editor: Editor | null; value: string }) => {
  const Icon = ALIGNMENTS.find((a) => a.value === value)?.Icon ?? AlignLeft;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Text alignment"
            className="text-muted-foreground h-8 gap-0.5 px-1.5"
            size="sm"
            variant="ghost"
          />
        }
      >
        <Icon />
        <ChevronDown className="size-3!" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-28 p-1">
        <DropdownMenuRadioGroup
          className="flex flex-col gap-0.5"
          value={value}
          onValueChange={(next) => editor?.chain().focus().setTextAlign(next).run()}
        >
          {ALIGNMENTS.map(({ Icon: ItemIcon, label, value: v }) => (
            <DropdownMenuRadioItem key={v} className={ACTIVE_ITEM} value={v}>
              <ItemIcon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Swatch = ({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color?: string;
  label: string;
  onClick: () => void;
}) => (
  <button
    aria-label={label}
    aria-pressed={active}
    className={cn(
      'relative flex size-6 items-center justify-center rounded-full border transition-transform active:scale-96',
      active && 'ring-ring ring-offset-background ring-2 ring-offset-1'
    )}
    onClick={onClick}
    style={{ background: color }}
    title={label}
    type="button"
  >
    {!color && <Ban className="text-muted-foreground size-3.5" />}
  </button>
);

const ColorMenu = ({
  editor,
  highlight,
  text,
}: {
  editor: Editor | null;
  highlight?: string;
  text?: string;
}) => (
  <Popover>
    <PopoverTrigger
      render={
        <Button
          aria-label="Text color"
          className="h-8 flex-col gap-0 px-1.5"
          size="sm"
          variant="ghost"
        />
      }
    >
      {/* A column of its own: the button's layout can put a bare bar beside the letter. */}
      <span aria-hidden className="flex flex-col items-center gap-0.5">
        <span className="text-[0.9375rem] leading-none font-semibold">A</span>
        <span
          className="h-[3px] w-4 rounded-full"
          style={{ background: highlight ?? text ?? 'currentColor' }}
        />
      </span>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto space-y-3 p-3">
      <div>
        <p className="text-muted-foreground mb-2 text-xs">Text</p>
        <div className="flex gap-1.5">
          <Swatch
            active={!text}
            label="Default text color"
            onClick={() => editor?.chain().focus().unsetColor().run()}
          />
          {TEXT_COLORS.map(({ label, value }) => (
            <Swatch
              key={value}
              active={text === value}
              color={value}
              label={label}
              onClick={() => editor?.chain().focus().setColor(value).run()}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-xs">Highlight</p>
        <div className="flex gap-1.5">
          <Swatch
            active={!highlight}
            label="No highlight"
            onClick={() => editor?.chain().focus().unsetHighlight().run()}
          />
          {HIGHLIGHTS.map(({ label, value }) => (
            <Swatch
              key={value}
              active={highlight === value}
              color={value}
              label={label}
              onClick={() => editor?.chain().focus().setHighlight({ color: value }).run()}
            />
          ))}
        </div>
      </div>
    </PopoverContent>
  </Popover>
);

/** Asks for a YouTube or Vimeo link and puts the video in the text. */
const VideoDialog = ({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (video: NonNullable<ReturnType<typeof parseVideoUrl>>) => void;
}) => {
  const [link, setLink] = useState('');
  const insert = () => {
    const video = parseVideoUrl(link);
    if (!video) {
      notify.error('That link is not supported', 'Paste a YouTube or Vimeo link.');
      return;
    }
    onInsert(video);
    setLink('');
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Embed a video</DialogTitle>
          <DialogDescription>
            Paste a YouTube or Vimeo link. Visitors watch it on the page without leaving.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Video link"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (isEnterKey(e)) {
              e.preventDefault();
              insert();
            }
          }}
          placeholder="https://www.youtube.com/watch?v=…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={insert}>Embed video</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InsertMenu = ({ editor }: { editor: Editor | null }) => {
  const run = (command: (chain: ReturnType<Editor['chain']>) => void) => {
    if (editor) {
      command(editor.chain().focus());
    }
  };
  const [pickingImage, setPickingImage] = useState(false);
  const [pickingVideo, setPickingVideo] = useState(false);
  const items = [
    // From the Media library, so the file lives in storage rather than as
    // base64 in the post body.
    {
      Icon: ImageIcon,
      label: 'Image',
      onSelect: () => setPickingImage(true),
    },
    {
      Icon: FileTypeVideoIcon,
      label: 'Video',
      onSelect: () => setPickingVideo(true),
    },
    {
      Icon: TableIcon,
      label: 'Table',
      onSelect: () => run((c) => c.insertTable({ cols: 3, rows: 3, withHeaderRow: true }).run()),
    },
    {
      Icon: Quote,
      label: 'Quote',
      onSelect: () => run((c) => c.toggleBlockquote().run()),
    },
    {
      Icon: Code2,
      label: 'Code block',
      onSelect: () => run((c) => c.toggleCodeBlock().run()),
    },
    {
      Icon: Minus,
      label: 'Divider',
      onSelect: () => run((c) => c.setHorizontalRule().run()),
    },
  ];
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button className="text-ui h-8 gap-1 px-2" size="sm" variant="ghost" />}
        >
          <Plus className="size-4" />
          Insert
          <ChevronDown className="text-muted-foreground size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36 p-1">
          {items.map(({ Icon, label, onSelect }) => (
            <DropdownMenuItem
              key={label}
              className="text-ui rounded-md py-1 [&_svg]:size-3.5!"
              onClick={onSelect}
            >
              <Icon />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <VideoDialog
        open={pickingVideo}
        onOpenChange={setPickingVideo}
        onInsert={(video) => {
          setPickingVideo(false);
          run((c) => c.setVideoEmbed(video).run());
        }}
      />
      <MediaPicker
        open={pickingImage}
        onOpenChange={setPickingImage}
        selectedId={null}
        onSelect={(item) => {
          setPickingImage(false);
          run((c) =>
            c.setImage({ src: item.url, alt: item.alt, title: item.caption || undefined }).run()
          );
        }}
      />
    </>
  );
};

const ListControls = ({
  editor,
  state,
}: {
  editor: Editor | null;
  state: EditorSnapshot | null;
}) => {
  const listCommand = (command: 'liftListItem' | 'sinkListItem') => {
    const chain = editor?.chain().focus();
    (editor?.can()[command]('listItem')
      ? chain?.[command]('listItem')
      : chain?.[command]('taskItem')
    )?.run();
  };
  return (
    <RichTextEditor.ControlsGroup>
      <RichTextEditor.BulletList />
      <RichTextEditor.OrderedList />
      <RichTextEditor.Control
        active={state?.taskList}
        aria-label="Task list"
        title="Task list"
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className="size-4" />
      </RichTextEditor.Control>
      <RichTextEditor.Control
        aria-label="Outdent"
        disabled={!state?.canOutdent}
        title="Outdent"
        onClick={() => listCommand('liftListItem')}
      >
        <IndentDecrease className="size-4" />
      </RichTextEditor.Control>
      <RichTextEditor.Control
        aria-label="Indent"
        disabled={!state?.canIndent}
        title="Indent"
        onClick={() => listCommand('sinkListItem')}
      >
        <IndentIncrease className="size-4" />
      </RichTextEditor.Control>
      <AlignMenu editor={editor} value={state?.align ?? 'left'} />
    </RichTextEditor.ControlsGroup>
  );
};

export const Toolbar = ({
  editor,
  state,
  className,
  underHeader = false,
}: {
  editor: Editor | null;
  state: EditorSnapshot | null;
  /** Where it sticks, when the page scrolls rather than the editor. */
  className?: string;
  /** It sticks under the app header, which then turns solid on phones (styles.css). */
  underHeader?: boolean;
}) => (
  <div
    data-under-header={underHeader || undefined}
    className={cn('sticky top-0 z-10 sm:px-3 sm:pt-3 sm:pb-1', CANVAS, className)}
  >
    <div
      className="mx-auto w-full max-w-full [scrollbar-width:none] overflow-x-auto border-b sm:w-fit sm:rounded-xl sm:border sm:shadow-sm [&::-webkit-scrollbar]:hidden"
      style={SCROLL_SHADOWS}
    >
      <RichTextEditor.Toolbar className="[&_.rte-controls-group>button:not([data-state=on]):not([aria-pressed=true])]:text-foreground! flex-nowrap! justify-start! border-0! bg-transparent! px-1! py-1! sm:w-max [&>*]:shrink-0">
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Undo />
          <RichTextEditor.Redo />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <TextStyleMenu editor={editor} value={state?.heading ?? '0'} />
          {/* No font picker: posts use the website typography. */}
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.Code />
          <ColorMenu editor={editor} highlight={state?.highlight} text={state?.color} />
          <RichTextEditor.Link />
          <RichTextEditor.Superscript />
          <RichTextEditor.Subscript />
          <RichTextEditor.ClearFormatting />
        </RichTextEditor.ControlsGroup>
        <span aria-hidden className="bg-border mx-1 h-4 w-px" />
        <ListControls editor={editor} state={state} />
        <RichTextEditor.ControlsGroup>
          <InsertMenu editor={editor} />
        </RichTextEditor.ControlsGroup>
      </RichTextEditor.Toolbar>
    </div>
    <div
      aria-hidden
      className="from-background via-background/80 pointer-events-none absolute inset-x-0 top-full h-6 bg-linear-to-b to-transparent blur-xs sm:hidden"
    />
  </div>
);
