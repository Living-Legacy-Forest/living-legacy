import { can } from '@ll/content';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { StatusPulse } from '@/components/system/status-pulse';
import { buttonVariants } from '@/components/ui/button';
import { formatInteger } from '@/lib/format';
import type { SessionUser } from '@/lib/session';
import type { StatusTone } from '@/lib/system-status';
import { cn } from '@/lib/utils';
import { type SystemSummary, getSystemSummary } from '@/server/system';

const LABEL: Record<StatusTone, string> = {
  green: 'System normal',
  yellow: 'Minor issues',
  red: 'System issue',
};

function describe(summary: SystemSummary) {
  if (summary.overall === 'green') return 'Everything is working.';
  return [
    summary.red > 0 &&
      `${formatInteger(summary.red)} ${summary.red === 1 ? 'thing needs' : 'things need'} a look.`,
    summary.yellow > 0 &&
      `${formatInteger(summary.yellow)} ${summary.yellow === 1 ? 'thing' : 'things'} to keep an eye on.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The header's system status for admins, beside the bell: a coloured pulse and
 * a word, linking to the System page. Loaded after the page and again when the
 * tab regains focus, as the bell is.
 */
export function SystemStatus({ user }: { user: SessionUser }) {
  const allowed = can(user, 'settings:write');
  // null until the first answer; 'unknown' if the check itself failed.
  const [summary, setSummary] = useState<SystemSummary | 'unknown' | null>(null);

  const load = useCallback(() => {
    getSystemSummary().then(setSummary, () => setSummary('unknown'));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [allowed, load]);

  if (!allowed || summary === null) return null;

  const tone = summary === 'unknown' ? 'yellow' : summary.overall;
  const label = summary === 'unknown' ? 'Status unknown' : LABEL[tone];
  const detail = summary === 'unknown' ? 'The system could not be checked.' : describe(summary);

  return (
    <Link
      to="/system"
      aria-label={`${label}. ${detail} Open System.`}
      title={detail}
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'font-normal')}
    >
      <StatusPulse tone={tone} label={label} />
    </Link>
  );
}
