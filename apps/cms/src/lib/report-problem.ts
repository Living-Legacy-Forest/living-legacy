// "Report a problem": Sentry's feedback form, opened from the account menu. It
// goes to Sentry with the session's recent errors and the user's id attached,
// so a report and the error behind it sit together. Only where Sentry runs
// (production); elsewhere the menu item is hidden.
import * as Sentry from '@sentry/tanstackstart-react';

export function canReportProblem(): boolean {
  return Sentry.getFeedback() !== undefined;
}

export async function openProblemReport(): Promise<void> {
  const feedback = Sentry.getFeedback();
  if (!feedback) return;
  const form = await feedback.createForm({ onFormClose: () => form.removeFromDom() });
  form.appendToDom();
  form.open();
}
