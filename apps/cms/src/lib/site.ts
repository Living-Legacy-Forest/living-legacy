import { notify } from './notify';

/** The public website. Links from the CMS go to production, the copy readers see. */
export const SITE_URL = 'https://livinglegacy.com.au';

export const siteUrl = (path: string) => new URL(path, SITE_URL).href;

export function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    notify.success({ title: 'Link copied', description: url });
  } catch (error) {
    notify.error('Could not copy the link', error);
  }
}
