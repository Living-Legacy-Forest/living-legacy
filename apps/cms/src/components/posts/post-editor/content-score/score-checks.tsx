import { type ContentScore, SCORE_CATEGORIES, type ScoreCheck } from '@ll/content';
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { tone } from './score-tone';

const ORDER = { critical: 0, warning: 1, pass: 2, skipped: 3 } as const;

const STATUS = {
  critical: { Icon: CircleAlertIcon, className: tone.bad, label: 'Critical' },
  warning: { Icon: TriangleAlertIcon, className: tone.mid, label: 'Warning' },
  pass: { Icon: CircleCheckIcon, className: tone.good, label: 'Passed' },
} as const;

/** Every check that applies, by category, problems first. */
export function ScoreChecks({ checks, categories }: Pick<ContentScore, 'checks' | 'categories'>) {
  return (
    <div className="space-y-4 pt-3">
      {SCORE_CATEGORIES.map(({ id, label }) => {
        const shown = checks
          .filter(
            (c): c is ScoreCheck & { status: keyof typeof STATUS } =>
              c.category === id && c.status !== 'skipped'
          )
          .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
        if (!shown.length) return null;
        return (
          <section key={id} aria-labelledby={`score-category-${id}`} className="space-y-1.5">
            <h4 id={`score-category-${id}`} className="flex justify-between text-xs font-medium">
              {label}
              <span className="text-muted-foreground tabular-nums">{categories[id]}</span>
            </h4>
            <ul className="space-y-2">
              {shown.map((c) => {
                const { Icon, className, label: statusLabel } = STATUS[c.status];
                return (
                  <li key={c.id} className="flex gap-2 text-xs">
                    <Icon aria-hidden className={cn('mt-0.5 size-3.5 shrink-0', className)} />
                    <div className="min-w-0">
                      <p>
                        <span className="sr-only">{statusLabel}: </span>
                        {c.message}
                      </p>
                      <p className="text-muted-foreground">{c.why}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
