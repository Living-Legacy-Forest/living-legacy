import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatBytes, formatDateTime } from '@/lib/format';
import { useAction } from '@/lib/use-action';
import { useTimeZone } from '@/lib/use-time-zone';
import { type MediaDetail, restoreMediaVersionFn } from '@/server/media';

/**
 * The files this one used to be, newest first, kept when it was replaced. Restoring one makes it
 * current again and keeps the file it replaces, so nothing is lost by trying.
 */
export function MediaVersions({
  mediaId,
  versions,
}: {
  mediaId: string;
  versions: MediaDetail['versions'];
}) {
  const router = useRouter();
  const zone = useTimeZone();
  const { run, pending } = useAction();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (versions.length === 0) return null;

  async function restore(versionId: string) {
    const result = await run(
      async () => {
        await restoreMediaVersionFn({ data: { id: mediaId, versionId } });
        return true;
      },
      {
        success: {
          title: 'Version restored',
          description: 'Everything using this file shows it. The one it replaced is kept here.',
        },
        error: 'Could not restore the version',
      }
    );
    if (result) setConfirming(null);
    await router.invalidate();
  }

  return (
    <section className="grid gap-2" aria-labelledby="m-versions">
      <h3 id="m-versions" className="text-sm font-medium">
        Earlier versions
      </h3>
      <ul className="grid gap-2 text-sm">
        {versions.map((v) => (
          <li key={v.id} className="grid gap-2 rounded-md border p-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="min-w-0 truncate font-medium">{v.filename}</span>
              <span className="text-muted-foreground text-xs">
                {formatBytes(v.size)}
                {v.width && v.height ? ` · ${v.width}×${v.height}` : ''}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Replaced {formatDateTime(v.replacedAt, zone)}
              {v.replacedBy ? ` by ${v.replacedBy}` : ''}
            </p>
            {confirming === v.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs">Make this the current file?</span>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => void restore(v.id)}
                >
                  {pending ? <Spinner /> : null}
                  Restore
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming(v.id)}
                >
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  render={<a href={`/api/media-versions/${v.id}`} download={v.filename} />}
                  nativeButton={false}
                >
                  Download
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
