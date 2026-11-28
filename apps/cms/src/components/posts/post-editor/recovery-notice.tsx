import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/format';
import type { PostEditorState } from './use-post-editor';

/**
 * Above the post when this browser kept unsaved changes from an earlier visit (a crash, a closed
 * tab). Restore puts them back in the editor, still unsaved; Discard throws them away.
 */
export function RecoveryNotice({ recovery }: { recovery: PostEditorState['recovery'] }) {
  if (!recovery) return null;

  return (
    <div
      role="status"
      className="bg-warning/10 text-warning-text flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm"
    >
      <p className="min-w-0 flex-1">
        This browser kept changes you had not saved, from {formatRelative(recovery.savedAt)}.
        {recovery.stale
          ? ' The post has been saved since, so restoring them replaces that version in the editor. Nothing changes until you save.'
          : ' Nothing changes until you save.'}
      </p>
      <Button size="sm" variant="outline" onClick={recovery.dismiss}>
        Discard
      </Button>
      <Button size="sm" onClick={recovery.restore}>
        Restore
      </Button>
    </div>
  );
}
