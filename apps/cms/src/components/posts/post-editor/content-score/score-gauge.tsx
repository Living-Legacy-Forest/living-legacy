import { scoreBand } from '@ll/content';
import { cn } from '@/lib/utils';
import { bandStroke, bandTone } from './score-tone';

const ARC = 'M10 50 A40 40 0 0 1 90 50';

/** A half-circle meter. The number and a word always show, so colour is never the only signal. */
export function ScoreGauge({ score }: { score: number }) {
  const { band, label } = scoreBand(score);
  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`Content score ${score} out of 100: ${label}`}
    >
      <svg viewBox="0 0 100 56" className="w-36" aria-hidden>
        <path d={ARC} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-muted" />
        {score > 0 && (
          <path
            d={ARC}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${score} 100`}
            className={cn(
              'transition-[stroke-dasharray] duration-300 motion-reduce:transition-none',
              bandStroke[band]
            )}
          />
        )}
      </svg>
      <p className="-mt-8 text-2xl font-semibold tabular-nums">
        {score}
        <span className="text-muted-foreground text-xs font-normal">/100</span>
      </p>
      <p className={cn('text-xs', bandTone[band])}>{label}</p>
    </div>
  );
}
