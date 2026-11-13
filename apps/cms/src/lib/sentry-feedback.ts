// "Report a problem" form, loaded when someone first asks for it. Its code (with screenshot
// capture) is a sizeable part of Sentry's browser SDK, and almost nobody opens it, so it stays
// out of the first load rather than being set up with Sentry at startup.
import { addIntegration, feedbackIntegration, getFeedback } from '@sentry/browser';

let added = false;

/** Adds the feedback form to the running Sentry client, once, and returns it. */
export function addFeedback() {
  if (!added && !getFeedback()) {
    added = true;
    addIntegration(
      // No name or email fields: reports carry the user's id, as errors do.
      feedbackIntegration({
        autoInject: false,
        colorScheme: 'system',
        showBranding: false,
        showName: false,
        showEmail: false,
        isNameRequired: false,
        isEmailRequired: false,
        enableScreenshot: true,
        formTitle: 'Report a problem',
        messageLabel: 'What went wrong?',
        messagePlaceholder: 'What were you doing, and what happened instead?',
        submitButtonLabel: 'Send report',
        successMessageText: 'Thanks. Your report has been sent.',
      })
    );
  }
  return getFeedback();
}
