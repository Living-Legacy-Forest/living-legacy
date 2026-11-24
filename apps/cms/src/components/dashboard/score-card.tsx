import { scoreBand } from '@ll/content';
import { Link } from '@tanstack/react-router';
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { CircleCheckIcon } from '@/components/icons';
import { ScoreGauge } from '@/components/posts/post-editor/content-score/score-gauge';
import { bandTone } from '@/components/posts/post-editor/content-score/score-tone';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { chartReveal } from '@/lib/chart-motion';
import { cn } from '@/lib/utils';
import type { ScoreSummary } from '@/server/post-score';

const BANDS = [
  { key: 'low', label: 'Needs work', fill: 'var(--destructive)' },
  { key: 'mid', label: 'Good', fill: 'var(--color-amber-500)' },
  { key: 'high', label: 'Strong', fill: 'var(--color-emerald-600)' },
] as const;

const chartConfig = { count: { label: 'Posts' } } satisfies ChartConfig;

const posts = (n: number) => `${n.toLocaleString('en-AU')} ${n === 1 ? 'post' : 'posts'}`;

/** How published posts score, and the ones to fix first. Advice only, like the editor panel. */
export function ScoreCard({ scores }: { scores: ScoreSummary }) {
  const published = scores.scored + scores.unscored;
  const data = BANDS.map((band) => ({ ...band, count: scores.bands[band.key] }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content score</CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="ghost"

            render={<Link to="/checks" />}
            nativeButton={false}
          >
            Content checks
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {published === 0 ? (
          <Empty className="border py-8 sm:col-span-2">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleCheckIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Nothing published yet</EmptyTitle>
              <EmptyDescription>Published posts are scored here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <section aria-labelledby="score-card-published" className="space-y-3">
              <Heading id="score-card-published">Published posts</Heading>
              <div data-reveal="3">
                {scores.average === null ? (
                  <p className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">None</span>
                    <span className="text-muted-foreground text-sm">scored yet</span>
                  </p>
                ) : (
                  <ScoreGauge
                    score={scores.average}
                    label="Average score"
                    detail={`Across ${posts(scores.scored)}`}
                    captioned
                  />
                )}
              </div>
              <p className="sr-only">
                {data.map((d) => `${d.label}: ${posts(d.count)}`).join('. ')}.
              </p>
              <ChartContainer
                data-reveal="4"
                config={chartConfig}
                className="aspect-auto h-28 w-full"
                aria-hidden
              >
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 32 }}>
                  <YAxis
                    dataKey="label"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={96}
                  />
                  <XAxis type="number" hide allowDecimals={false} />
                  <Bar dataKey="count" radius={4} {...chartReveal}>
                    {data.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      className="fill-foreground tabular-nums"
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </section>
            <section aria-labelledby="score-card-lowest" className="space-y-2">
              <Heading id="score-card-lowest">Lowest scores</Heading>
              {scores.lowest.length === 0 ? (
                <p className="text-muted-foreground text-sm">No posts scored yet.</p>
              ) : (
                <ItemGroup className="gap-0 max-md:divide-y max-md:divide-(--ios-separator)">
                  {scores.lowest.map((post) => (
                    <Item
                      key={post.id}
                      size="sm"
                      className="-mx-2 px-2"
                      render={<Link to="/posts/$postId" params={{ postId: post.id }} />}
                    >
                      <ItemContent>
                        <ItemTitle className="line-clamp-1">{post.title || 'Untitled'}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            bandTone[scoreBand(post.score).band]
                          )}
                        >
                          {post.score}
                          <span className="sr-only"> out of 100</span>
                        </span>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </section>
          </>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        Scores update when a post is saved, and each night.
        {scores.unscored > 0 && ` ${posts(scores.unscored)} not scored yet.`}
      </CardFooter>
    </Card>
  );
}

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="text-muted-foreground text-xs font-medium max-md:text-[0.8125rem] max-md:font-normal max-md:text-(--ios-secondary) max-md:uppercase"
    >
      {children}
    </h2>
  );
}
