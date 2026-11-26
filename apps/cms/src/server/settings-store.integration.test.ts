import { SITE_SETTINGS_DEFAULTS } from '@ll/content';
import { activityLog, siteSettings } from '@ll/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, testDb } from '../../test/fixtures';
import { readSiteSettings, writeSiteSettings } from '@/lib/site-settings';
import { keepIntegrationSettings, saveBookingConfirmations } from './settings-store';

let userId: string;

beforeEach(async () => {
  await testDb().delete(siteSettings);
  await testDb().delete(activityLog);
  userId = await addUser('admin', 'Sam Tester');
});

describe('saveBookingConfirmations', () => {
  it('starts on, and saves off and on again', async () => {
    const actor = { id: userId, name: 'Sam Tester' };
    expect((await readSiteSettings()).sendBookingConfirmations).toBe(true);

    await saveBookingConfirmations(testDb(), false, actor);
    expect((await readSiteSettings()).sendBookingConfirmations).toBe(false);

    await saveBookingConfirmations(testDb(), true, actor);
    expect((await readSiteSettings()).sendBookingConfirmations).toBe(true);
  });

  it('leaves the other settings alone, and logs the change', async () => {
    await writeSiteSettings(testDb(), { ...SITE_SETTINGS_DEFAULTS, siteTitle: 'Kept' }, userId);
    await saveBookingConfirmations(testDb(), false, { id: userId, name: 'Sam Tester' });

    expect((await readSiteSettings()).siteTitle).toBe('Kept');
    const [entry] = await testDb().select().from(activityLog);
    expect(entry).toMatchObject({
      actorId: userId,
      action: 'settings.updated',
      summary: 'Turned booking confirmations off',
    });
  });
});

describe('saving the Settings page', () => {
  it('does not change the booking confirmations switch', async () => {
    await saveBookingConfirmations(testDb(), false, { id: userId, name: 'Sam Tester' });

    // The Settings form was opened before the switch changed, so it still holds `true`.
    const stale = {
      ...SITE_SETTINGS_DEFAULTS,
      siteTitle: 'Edited',
      sendBookingConfirmations: true,
    };
    await writeSiteSettings(
      testDb(),
      keepIntegrationSettings(await readSiteSettings(), stale),
      userId
    );

    const saved = await readSiteSettings();
    expect(saved.siteTitle).toBe('Edited');
    expect(saved.sendBookingConfirmations).toBe(false);
  });

  it('does not change the tracking ids either', async () => {
    await writeSiteSettings(testDb(), { ...SITE_SETTINGS_DEFAULTS, gtmId: 'GTM-ABC1234' }, userId);
    const stale = { ...SITE_SETTINGS_DEFAULTS, gtmId: '' };
    const merged = keepIntegrationSettings(await readSiteSettings(), stale);
    expect(merged.gtmId).toBe('GTM-ABC1234');
  });
});
