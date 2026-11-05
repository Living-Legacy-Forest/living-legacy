/**
 * The submit workflow every form on the site shares: check the form's
 * HubSpot GUID is configured, POST the payload, and never claim success
 * unless HubSpot actually accepted it. An accepted submission sends a
 * `generate_lead` event before the visitor moves on. On any failure — an unconfigured
 * GUID or a failed request — the caller's fallback panel is shown and a
 * short toast fires; the caller keeps whatever the visitor typed, since
 * this hook never touches field state.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { type FormType, trackLead } from '@/lib/analytics';
import { hubspot, isHubspotConfigured, submitUrl, type HubSpotPayload } from '@/lib/forms';

interface UseHubspotSubmitOptions {
  /** Which HubSpot form GUID to submit against. */
  formKey: keyof typeof hubspot.forms;
  /** The `?type=` query value the visitor lands on /thank-you-contact/ with,
   *  and the `form_type` of the lead event. */
  successType: FormType;
  /** Shown in the toast whenever the fallback panel appears. */
  toastMessage: string;
}

export function useHubspotSubmit({ formKey, successType, toastMessage }: UseHubspotSubmitOptions) {
  const [sending, setSending] = useState(false);
  const [fallbackVisible, setFallbackVisible] = useState(false);

  const showFallback = (): void => {
    setFallbackVisible(true);
    toast.error(toastMessage);
  };

  const hideFallback = (): void => setFallbackVisible(false);

  const submit = async (payload: HubSpotPayload): Promise<void> => {
    if (!isHubspotConfigured(formKey)) {
      showFallback();
      return;
    }

    setSending(true);

    try {
      const response = await fetch(submitUrl(formKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HubSpot ${response.status}`);

      await trackLead(successType);
      window.location.assign(`/thank-you-contact/?type=${successType}`);
    } catch (error) {
      console.error('Form submission failed', error);
      showFallback();
      setSending(false);
    }
  };

  return { sending, fallbackVisible, showFallback, hideFallback, submit };
}
