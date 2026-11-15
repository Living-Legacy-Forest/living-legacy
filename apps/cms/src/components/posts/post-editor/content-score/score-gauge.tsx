import { SCORE_BANDS } from '@ll/content';
import { Gauge, type GaugeThreshold } from '@/components/arc/gauge/gauge';
import { cn } from '@/lib/utils';

/** The gauge's colour and word change at the same lines as everywhere else a score shows. */
const BANDS: GaugeThreshold[] = [
  { from: 0, tone: 'danger', label: 'Needs work' },
  { from: SCORE_BANDS.good, tone: 'warning', label: 'Good' },
  { from: SCORE_BANDS.strong, tone: 'success', label: 'Strong' },
];

/**
 * A score out of 100 as the gauge: the figure, and a word with the colour, so colour is never the
 * only signal. It is named for screen readers either way; `captioned` also shows the name and
 * `detail` under it, where the gauge stands on its own (the panel's heading already says it).
 */
export function ScoreGauge({
  score,
  label = 'Content score',
  detail,
  captioned = false,
}: {
  score: number;
  label?: string;
  detail?: string;
  captioned?: boolean;
}) {
  return (
    <div className={cn('w-full', !captioned && '[&_figcaption]:sr-only')}>
      <Gauge value={score} label={label} detail={detail} thresholds={BANDS} />
    </div>
  );
}
