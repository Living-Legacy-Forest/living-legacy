import { useUpdates } from '@/components/shell/updates';
import { buildInfo } from '@/lib/build-info';
import { formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/use-time-zone';
import { cn } from '@/lib/utils';

const linkClass = 'hover:text-foreground tabular-nums underline-offset-4 hover:underline';

/** A quiet line under the dashboard naming the build that is running. */
export function AppVersion() {
  const { version, releaseUrl, commit, commitUrl, builtAt, isDev } = buildInfo;
  const timeZone = useTimeZone();
  const { openDialog } = useUpdates();
  return (
    <p className="text-muted-foreground col-span-full pt-2 text-center text-xs">
      Version{' '}
      <a
        href={releaseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(linkClass, 'font-medium')}
      >
        {version}
      </a>
      {commit && commitUrl && (
        <>
          {' ('}
          <a href={commitUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {commit}
          </a>
          {')'}
        </>
      )}
      {isDev ? ' · local development' : ` · built ${formatDateTime(builtAt, timeZone)}`}
      {' · '}
      <button type="button" onClick={() => openDialog('all')} className={linkClass}>
        What's new
      </button>
    </p>
  );
}
