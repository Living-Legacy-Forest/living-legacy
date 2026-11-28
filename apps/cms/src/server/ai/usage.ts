import { type AiGroup, parseSiteSettings, toZoned } from '@ll/content';
import type { Db } from '@ll/db';
import { aiUsage, siteSettings } from '@ll/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import { type Outcome, SuggestError, type Usage } from './run';

const OFF = 'The writing assistant is switched off. An admin can turn it on in Settings.';
const GROUP_OFF = 'That kind of suggestion is switched off. An admin can turn it on in Settings.';

/** Days of counts kept. Only today's matters; a few more make a problem easy to look back on. */
const KEEP_DAYS = 7;

/** The calendar day of `now` in `timeZone`, YYYY-MM-DD: when a person's count starts again. */
export function usageDay(now: Date, timeZone: string): string {
  const { year, month, day } = toZoned(now.getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** What Settings says about the assistant: whether it is on, each person's daily limit, and when a day ends. */
export async function loadAssistantSettings(db: Db) {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 'site') });
  const settings = parseSiteSettings(row?.data);
  return {
    enabled: settings.aiEnabled,
    dailyLimit: settings.aiDailyLimit,
    timeZone: settings.timeZone,
    /** Which kinds of suggestion are on. */
    groups: {
      searchText: settings.aiSearchText,
      summaries: settings.aiSummaries,
      tags: settings.aiTags,
      imageText: settings.aiImageText,
      brandFixes: settings.aiBrandFixes,
    } satisfies Record<AiGroup, boolean>,
    /** The admin's note added to the instructions, or ''. */
    instructions: settings.aiInstructions.trim(),
  };
}

/**
 * Takes one of the person's suggestions for today, or throws that the assistant is switched off
 * or the day is used up. One statement does the checking and the counting, so many presses at once
 * cannot slip past the limit. Call it after everything that can fail without reaching the model,
 * so those do not use one up. A super admin's use is `unrecorded`: it still stops when the
 * assistant is switched off, but is not counted, so it has no daily limit.
 */
export async function reserveSuggestion(
  db: Db,
  userId: string,
  {
    limit,
    now = new Date(),
    timeZone,
    unrecorded = false,
    group,
  }: {
    limit?: number;
    now?: Date;
    timeZone?: string;
    unrecorded?: boolean;
    /** The kind of suggestion; refused when an admin has switched that kind off. */
    group?: AiGroup;
  } = {}
): Promise<void> {
  const settings = await loadAssistantSettings(db);
  if (!settings.enabled) throw new SuggestError(OFF);
  if (group && !settings.groups[group]) throw new SuggestError(GROUP_OFF);
  if (unrecorded) return;
  const max = limit ?? settings.dailyLimit;
  const zone = timeZone ?? settings.timeZone;
  const day = usageDay(now, zone);
  const oldest = usageDay(new Date(now.getTime() - KEEP_DAYS * 86_400_000), zone);

  const [taken] = await db.batch([
    db
      .insert(aiUsage)
      .values({ userId, day, count: 1 })
      .onConflictDoUpdate({
        target: [aiUsage.userId, aiUsage.day],
        set: { count: sql`${aiUsage.count} + 1` },
        // Past the limit the row is left alone and nothing comes back.
        setWhere: lt(aiUsage.count, max),
      })
      .returning({ count: aiUsage.count }),
    // Tidy as we go, so the table only holds recent days.
    db.delete(aiUsage).where(and(eq(aiUsage.userId, userId), lt(aiUsage.day, oldest))),
  ]);
  if (taken.length === 0) {
    throw new SuggestError(`You've used today's ${max} suggestions. They start again at midnight.`);
  }
}

/** Adds what one suggestion used to the person's day, for the System page. */
export async function recordUsage(
  db: Db,
  userId: string,
  { usage, outcome }: { usage: Usage; outcome: Outcome },
  {
    now = new Date(),
    timeZone,
    unrecorded = false,
  }: { now?: Date; timeZone?: string; unrecorded?: boolean } = {}
): Promise<void> {
  if (unrecorded) return;
  const day = usageDay(now, timeZone ?? (await loadAssistantSettings(db)).timeZone);
  const refused = outcome === 'refused' ? 1 : 0;
  const failed = outcome === 'error' || outcome === 'guard_failed' ? 1 : 0;
  const added = {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    cacheWriteTokens: usage.cache_creation_input_tokens,
    refused,
    failed,
  };
  await db
    .insert(aiUsage)
    .values({ userId, day, count: 0, ...added })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        inputTokens: sql`${aiUsage.inputTokens} + ${added.inputTokens}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${added.outputTokens}`,
        cacheReadTokens: sql`${aiUsage.cacheReadTokens} + ${added.cacheReadTokens}`,
        cacheWriteTokens: sql`${aiUsage.cacheWriteTokens} + ${added.cacheWriteTokens}`,
        refused: sql`${aiUsage.refused} + ${refused}`,
        failed: sql`${aiUsage.failed} + ${failed}`,
      },
    });
}
