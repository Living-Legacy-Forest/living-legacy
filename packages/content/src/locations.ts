// Living Legacy locations, for the national location directory and each
// location's page. Shared by the CMS (to validate and edit) and the site (to
// render). The state is a filter in the directory, never a page of its own.

export const australianStates = ['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export type AustralianState = (typeof australianStates)[number];

export const australianStateLabels: Record<AustralianState, string> = {
  QLD: 'Queensland',
  NSW: 'New South Wales',
  VIC: 'Victoria',
  WA: 'Western Australia',
  SA: 'South Australia',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
  NT: 'Northern Territory',
};

/**
 * Where a location stands. `live` has its page on this site; `external` is
 * an existing location whose website has not moved here yet, so the directory
 * links to it; `coming_soon` is listed but has no page to visit.
 */
export const locationStages = ['live', 'external', 'coming_soon'] as const;
export type LocationStage = (typeof locationStages)[number];

export const locationStageLabels: Record<LocationStage, string> = {
  live: 'Live on this site',
  external: 'On its own website',
  coming_soon: 'Coming soon',
};
