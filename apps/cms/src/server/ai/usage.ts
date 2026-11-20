import { parseSiteSettings, toZoned } from '@ll/content';
import type { Db } from '@ll/db';
import { aiUsage, siteSettings } from '@ll/db/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import { SuggestError } from './run';

/** How many suggestions one person can ask for in a day. Counted per press, not per retry. */
export const DAILY_SUGGESTION_LIMIT = 100;

/** Days of counts kept. Only today's matters; a few more make a problem easy to look back on. */
const KEEP_DAYS = 7;

/** The calendar day of `now` in `timeZone`, YYYY-MM-DD: when a person's count starts again. */
export function usageDay(now: Date, timeZone: string): string {
  const { year, month, day } = toZoned(now.getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/**
 * Takes one of the person's suggestions for today, or throws that the day is used up. One
 * statement does the checking and the counting, so many presses at once cannot slip past the limit.
 * Call it after everything that can fail without reaching the model, so those do not use one up.
 */
export async function reserveSuggestion(
  db: Db,
  userId: string,
  {
    limit = DAILY_SUGGESTION_LIMIT,
    now = new Date(),
    timeZone,
  }: { limit?: number; now?: Date; timeZone?: string } = {}
): Promise<void> {
  const zone = timeZone ?? parseSiteSettings(await storedSettings(db)).timeZone;
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
        setWhere: lt(aiUsage.count, limit),
      })
      .returning({ count: aiUsage.count }),
    // Tidy as we go, so the table only holds recent days.
    db.delete(aiUsage).where(and(eq(aiUsage.userId, userId), lt(aiUsage.day, oldest))),
  ]);
  if (taken.length === 0) {
    throw new SuggestError(
      `You've used today's ${limit} suggestions. They start again at midnight.`
    );
  }
}

async function storedSettings(db: Db) {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 'site') });
  return row?.data;
}
