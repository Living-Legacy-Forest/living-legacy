import { useMemo, useState } from 'react';
import {
  ShortcutList,
  ShortcutRecorder,
  usePlatform,
  type Platform,
  type ShortcutBinding,
  type ShortcutListGroup,
} from '@/components/arc/shortcut-recorder/shortcut-recorder';
import { SegmentedControl } from '@/components/segmented-control';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS, setShortcut, shortcutIds, useShortcut, type ShortcutId } from '@/lib/shortcuts';

// Keys that always work and cannot be changed.
const fixed: ShortcutListGroup[] = [
  {
    label: 'Lists',
    items: [
      { label: 'Select the focused row', shortcut: 'x' },
      { label: 'Select every row shown', shortcut: 'mod+a', keywords: 'all' },
      { label: 'Clear the selection', shortcut: 'escape', keywords: 'deselect' },
      {
        label: 'Delete the focused row, or move a post to the trash',
        shortcut: 'backspace',
        keywords: 'remove',
      },
      { label: 'Move up the posts list', shortcut: 'up' },
      { label: 'Move down the posts list', shortcut: 'down' },
      { label: 'Move the focused FAQ or team member up', shortcut: 'alt+up' },
      { label: 'Move the focused FAQ or team member down', shortcut: 'alt+down' },
    ],
  },
];

function Recorder({
  id,
  platform,
  bindings,
}: {
  id: ShortcutId;
  platform: Platform;
  bindings: ShortcutBinding[];
}) {
  const value = useShortcut(id);
  return (
    <ShortcutRecorder
      label={SHORTCUTS[id].label}
      value={value}
      resetValue={SHORTCUTS[id].fallback}
      platform={platform}
      bindings={bindings}
      placeholder="Record shortcut"
      onValueChange={(next, { replaced }) => {
        setShortcut(id, next);
        // "Use anyway" takes the combination from whichever shortcut had it.
        const taken =
          replaced && shortcutIds.find((other) => SHORTCUTS[other].label === replaced.label);
        if (taken) setShortcut(taken, null);
      }}
    />
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detected = usePlatform();
  const [chosen, setChosen] = useState<Platform | null>(null);
  const platform = chosen ?? detected;

  const search = useShortcut('commandMenu');
  const sidebar = useShortcut('toggleSidebar');
  const save = useShortcut('savePost');
  const current: Record<ShortcutId, string | null> = {
    commandMenu: search,
    toggleSidebar: sidebar,
    savePost: save,
  };

  // What the recorders check a new key against: every other key in use here.
  const allBindings = useMemo(
    () => [
      ...shortcutIds.flatMap((id) =>
        current[id] ? [{ shortcut: current[id], label: SHORTCUTS[id].label }] : []
      ),
      ...fixed.flatMap((group) =>
        group.items.map((item) => ({ shortcut: item.shortcut, label: item.label }))
      ),
    ],
    [search, sidebar, save]
  );

  const groups: ShortcutListGroup[] = [
    {
      label: 'Anywhere',
      items: [
        ...(search ? [{ label: SHORTCUTS.commandMenu.label, shortcut: search }] : []),
        ...(sidebar ? [{ label: SHORTCUTS.toggleSidebar.label, shortcut: sidebar }] : []),
      ],
    },
    ...(save
      ? [{ label: 'Posts', items: [{ label: SHORTCUTS.savePost.label, shortcut: save }] }]
      : []),
    ...fixed,
  ].filter((group) => group.items.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="grid min-h-0 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="flex flex-col gap-5 p-6 md:border-r">
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
              <DialogDescription>
                Click one to change it. Your changes stay in this browser.
              </DialogDescription>
            </DialogHeader>
            <SegmentedControl<Platform>
              label="Show keys for"
              value={platform}
              onValueChange={setChosen}
              options={[
                { value: 'mac', label: 'Mac' },
                { value: 'other', label: 'Windows' },
              ]}
              className="self-start"
            />
            {shortcutIds.map((id) => (
              <Recorder
                key={id}
                id={id}
                platform={platform}
                bindings={allBindings.filter((binding) => binding.label !== SHORTCUTS[id].label)}
              />
            ))}
          </div>
          <div className="max-h-[60svh] overflow-y-auto p-6 md:max-h-[80svh] md:pt-14">
            <ShortcutList groups={groups} platform={platform} label="Keyboard shortcuts" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
