// What the System page shows about the writing assistant, against local D1.
import { aiUsage, siteSettings } from '@ll/db/schema';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../../test/fixtures';
import { estimateCostUsd } from './pricing';
import { loadAssistantSummary } from './summary';

const now = Date.parse('2026-11-20T01:00:00Z');
const opts = { now, timeZone: 'UTC' };

beforeEach(async () => {
  await testDb().delete(aiUsage);
  await testDb().delete(siteSettings);
  delete (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
});

async function seed() {
  const sam = await addUser('editor', 'Sam Tester');
  const alex = await addUser('author', 'Alex Tester');
  await testDb()
    .insert(aiUsage)
    .values([
      {
        userId: sam,
        day: '2026-11-20',
        count: 6,
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 9000,
        cacheWriteTokens: 500,
        refused: 1,
      },
      { userId: sam, day: '2026-11-18', count: 4, inputTokens: 400, outputTokens: 80 },
      { userId: alex, day: '2026-11-20', count: 3, inputTokens: 300, outputTokens: 60, failed: 2 },
      // Older than the week: left out.
      { userId: alex, day: '2026-11-10', count: 99, inputTokens: 99_000 },
    ]);
}

describe('loadAssistantSummary', () => {
  it("totals today's suggestions, people, tokens and outcomes", async () => {
    await seed();
    const { today } = await loadAssistantSummary(testDb(), opts);
    expect(today).toMatchObject({
      suggestions: 9,
      people: 2,
      inputTokens: 1300,
      outputTokens: 260,
      cacheReadTokens: 9000,
      cacheWriteTokens: 500,
      refused: 1,
      failed: 2,
    });
    expect(today.costUsd).toBeCloseTo(
      estimateCostUsd({
        inputTokens: 1300,
        outputTokens: 260,
        cacheReadTokens: 9000,
        cacheWriteTokens: 500,
      })
    );
  });

  it('totals the last seven days and leaves out older ones', async () => {
    await seed();
    const { week } = await loadAssistantSummary(testDb(), opts);
    expect(week).toMatchObject({ suggestions: 13, people: 2, inputTokens: 1700 });
  });

  it('has a row for each of the seven days, oldest first, with the empty ones as zero', async () => {
    await seed();
    const { days } = await loadAssistantSummary(testDb(), opts);
    expect(days.map((d) => d.day)).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ]);
    expect(days.map((d) => d.suggestions)).toEqual([0, 0, 0, 0, 4, 0, 9]);
  });

  it('lists who used the most today, by name', async () => {
    await seed();
    const { top } = await loadAssistantSummary(testDb(), opts);
    expect(top).toEqual([
      { name: 'Sam Tester', count: 6 },
      { name: 'Alex Tester', count: 3 },
    ]);
  });

  it('is all zeros with no use, and says whether the key is set and the switch is on', async () => {
    const empty = await loadAssistantSummary(testDb(), opts);
    expect(empty.today.suggestions).toBe(0);
    expect(empty.days).toHaveLength(7);
    expect(empty.top).toEqual([]);
    expect(empty).toMatchObject({ keySet: false, switchedOn: true, dailyLimit: 100 });

    (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY = 'test-key';
    await testDb()
      .insert(siteSettings)
      .values({ id: 'site', data: { aiEnabled: false, aiDailyLimit: 40 } });
    expect(await loadAssistantSummary(testDb(), opts)).toMatchObject({
      keySet: true,
      switchedOn: false,
      dailyLimit: 40,
    });
  });
});
