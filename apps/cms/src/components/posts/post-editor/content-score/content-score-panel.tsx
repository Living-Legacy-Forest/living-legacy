import {
  type BrandFinding,
  type ContentScore,
  type StructureCount,
  type TermUse,
  structureCaption,
  structureProgress,
} from '@ll/content';
import { useState } from 'react';
import { ChevronRightIcon, CircleAlertIcon, TriangleAlertIcon } from '@/components/icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ScoreChecks } from './score-checks';
import { ScoreGauge } from './score-gauge';
import { tone } from './score-tone';

/** The score, structure counts, terms and brand problems for the post being edited. Advice only. */
export function ContentScorePanel({ result }: { result: ContentScore }) {
  const [details, setDetails] = useState(false);
  return (
    <div className="space-y-5 pt-3">
      <div className="flex flex-col items-center">
        <ScoreGauge score={result.score} />
        <Collapsible open={details} onOpenChange={setDetails} className="w-full">
          <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground touch:min-h-11 mx-auto flex min-h-8 items-center gap-1 text-xs">
            Details
            <ChevronRightIcon
              aria-hidden
              className="size-3.5 transition-transform duration-150 group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScoreChecks checks={result.checks} categories={result.categories} />
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Structure structure={result.structure} />
      <Terms terms={result.terms} />
      <Brand brand={result.brand} />
      <p className="text-muted-foreground text-xs">
        {result.source === 'settings'
          ? 'Targets from Settings.'
          : 'Targets from top-ranking pages.'}
      </p>
    </div>
  );
}

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="text-xs font-medium">
      {children}
    </h3>
  );
}

const BAR = {
  within: 'bg-emerald-600 dark:bg-emerald-400',
  below: 'bg-amber-500',
  above: 'bg-amber-500',
} as const;

function Structure({ structure }: { structure: StructureCount[] }) {
  return (
    <section aria-labelledby="score-structure" className="space-y-2">
      <Heading id="score-structure">Structure</Heading>
      <ul className="grid grid-cols-2 gap-2">
        {structure.map((s) => (
          <li key={s.key} className="bg-muted/50 min-w-0 space-y-1.5 rounded-md px-2.5 py-2">
            <p className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground truncate text-xs">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums">
                {s.value.toLocaleString('en-AU')}
              </span>
            </p>
            {/* The caption says the same in words, so the bar is decoration. */}
            <div aria-hidden className="bg-border h-1 overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
                  BAR[s.state]
                )}
                style={{ width: `${Math.round(structureProgress(s) * 100)}%` }}
              />
            </div>
            <p
              className={cn(
                'text-[0.7rem] leading-tight',
                s.state === 'within' ? 'text-muted-foreground' : tone.mid
              )}
            >
              {structureCaption(s)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const CHIP = {
  met: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  partial: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  unused: 'bg-destructive/10 text-destructive',
} as const;

const CHIP_LABEL = {
  met: 'target met',
  partial: 'used, below target',
  unused: 'not used yet',
} as const;

function Terms({ terms }: { terms: TermUse[] }) {
  return (
    <section aria-labelledby="score-terms" className="space-y-2">
      <Heading id="score-terms">Terms</Heading>
      {terms.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add a focus keyword in Search listing to see how it is used.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {terms.map((term) => (
            <li
              key={`${term.kind}:${term.term}`}
              className={cn(
                'flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                CHIP[term.state],
                term.kind === 'focus' && 'font-medium'
              )}
            >
              <span className="min-w-0 truncate">{term.term}</span>
              <span className="tabular-nums opacity-80">
                {term.count}/{term.min}
              </span>
              <span className="sr-only">
                {CHIP_LABEL[term.state]}
                {term.kind === 'focus' ? ', focus keyword' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Brand({ brand }: { brand: BrandFinding[] }) {
  return (
    <section aria-labelledby="score-brand" className="space-y-2">
      <Heading id="score-brand">Brand language</Heading>
      {brand.length === 0 ? (
        <p className="text-muted-foreground text-xs">No brand language problems.</p>
      ) : (
        <ul className="space-y-1.5">
          {brand.map((finding) => {
            const critical = finding.severity === 'critical';
            const Icon = critical ? CircleAlertIcon : TriangleAlertIcon;
            return (
              <li key={`${finding.kind}:${finding.found}`} className="flex gap-2 text-xs">
                <Icon
                  aria-hidden
                  className={cn('mt-0.5 size-3.5 shrink-0', critical ? tone.bad : tone.mid)}
                />
                <span className="min-w-0">
                  <span className="sr-only">{critical ? 'Never use: ' : 'Check: '}</span>
                  <span className="font-medium">{finding.found}</span>
                  {finding.count > 1 && (
                    <span className="text-muted-foreground tabular-nums"> ×{finding.count}</span>
                  )}
                  <span className="text-muted-foreground"> → {finding.instead}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
