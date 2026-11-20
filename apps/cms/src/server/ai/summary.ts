import type { Db } from '@ll/db';
import { aiUsage, user } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { desc, eq, gte } from 'drizzle-orm';
import { dayKeys } from '@/lib/dashboard-trend';
import { estimateCostUsd } from './pricing';
import { loadAssistantSettings } from './usage';

type Row = typeof aiUsage.$inferSelect;

export type AssistantTotals = {
  suggestions: number;
  /** People who asked for at least one. */
  people: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  refused: number;
  failed: number;
  /** An estimate at list prices; the Anthropic Console has the real bill. */
  costUsd: number;
};

function totalsOf(rows: Row[]): AssistantTotals {
  const sum = (pick: (row: Row) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const totals = {
    suggestions: sum((r) => r.count),
    people: new Set(rows.filter((r) => r.count > 0).map((r) => r.userId)).size,
    inputTokens: sum((r) => r.inputTokens),
    outputTokens: sum((r) => r.outputTokens),
    cacheReadTokens: sum((r) => r.cacheReadTokens),
    cacheWriteTokens: sum((r) => r.cacheWriteTokens),
    refused: sum((r) => r.refused),
    failed: sum((r) => r.failed),
  };
  return { ...totals, costUsd: estimateCostUsd(totals) };
}

/** The writing assistant on the System page: its state, today, the last seven days and who used it. */
export async function loadAssistantSummary(
  db: Db,
  { now = Date.now(), timeZone }: { now?: number; timeZone?: string } = {}
) {
  const settings = await loadAssistantSettings(db);
  const days = dayKeys(7, timeZone ?? settings.timeZone, now);
  const [first] = days as [string, ...string[]];
  const today = days[days.length - 1]!;

  const rows = await db
    .select({ usage: aiUsage, name: user.name })
    .from(aiUsage)
    .innerJoin(user, eq(user.id, aiUsage.userId))
    .where(gte(aiUsage.day, first))
    .orderBy(desc(aiUsage.count));

  const week = rows.map((row) => row.usage);
  const todays = rows.filter((row) => row.usage.day === today);
  return {
    keySet: Boolean(env.ANTHROPIC_API_KEY),
    switchedOn: settings.enabled,
    dailyLimit: settings.dailyLimit,
    today: totalsOf(todays.map((row) => row.usage)),
    week: totalsOf(week),
    days: days.map((day) => ({
      day,
      suggestions: week.filter((row) => row.day === day).reduce((n, row) => n + row.count, 0),
    })),
    top: todays
      .filter((row) => row.usage.count > 0)
      .slice(0, 5)
      .map((row) => ({ name: row.name, count: row.usage.count })),
  };
}

export type AssistantSummary = Awaited<ReturnType<typeof loadAssistantSummary>>;
