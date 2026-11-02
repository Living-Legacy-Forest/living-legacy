import { buildInfo } from '@/lib/build-info';
import { formatDateTime } from '@/lib/format';

/** A quiet line under the dashboard naming the build that is running. */
export function AppVersion() {
  const { version, commitUrl, builtAt, isDev } = buildInfo;
  return (
    <p className="text-muted-foreground col-span-full pt-2 text-center text-xs">
      Version{' '}
      {commitUrl ? (
        <a
          href={commitUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground font-medium tabular-nums underline-offset-4 hover:underline"
        >
          {version}
        </a>
      ) : (
        <span className="font-medium">{version}</span>
      )}
      {isDev ? ' · local development' : ` · built ${formatDateTime(builtAt)}`}
    </p>
  );
}
