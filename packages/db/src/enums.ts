// No drizzle imports here: browser code (form validators) imports these, and
// must not pull the table definitions into the client bundle.

export const entityTypes = [
  'post',
  'faq',
  'testimonial',
  'team_member',
  'media_coverage',
  'location',
  'settings',
] as const;
export type EntityType = (typeof entityTypes)[number];

export const activityActions = [
  'post.published',
  'post.scheduled',
  'post.unpublished',
  'user.invited',
  'user.role_changed',
  'user.removed',
  'user.photo_changed',
  'redirect.created',
  'redirect.updated',
  'redirect.deleted',
  'settings.updated',
  'api_key.created',
  'api_key.revoked',
  'post.created_via_api',
  'post.updated_via_api',
  'event.saved',
  'event.cancelled',
  'event.deleted',
  'event.guest_added',
  'event.guest_cancelled',
] as const;
export type ActivityAction = (typeof activityActions)[number];

export const apiKeyScopes = ['read', 'write'] as const;
export type ApiKeyScope = (typeof apiKeyScopes)[number];

/** The longest side an uploaded image may have; the CMS scales larger ones down first. */
export const maxImageSide = 2560;

/** Widths of the smaller copies made of each image at upload, for `?w=`. */
export const mediaVariantWidths = [640, 1280] as const;
export type MediaVariant = { width: number; key: string; mime: string };
