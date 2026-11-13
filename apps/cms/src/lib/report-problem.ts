// "Report a problem": Sentry's feedback form, opened from the account menu. It
// goes to Sentry with the session's recent errors and the user's id attached,
// so a report and the error behind it sit together. Only where Sentry runs
// (production); elsewhere the menu item is hidden. The form's code loads on
// the first click (lib/sentry-feedback.ts).
import * as Sentry from '@sentry/tanstackstart-react';

export function canReportProblem(): boolean {
  const client = Sentry.getClient();
  return client !== undefined && client.getOptions().enabled !== false;
}

export async function openProblemReport(): Promise<void> {
  // A dynamic import, so the form's code is fetched now and not with the page.
  const feedback = (await import('./sentry-feedback')).addFeedback();
  if (!feedback) return;
  const form = await feedback.createForm({ onFormClose: () => form.removeFromDom() });
  form.appendToDom();
  form.open();
}
