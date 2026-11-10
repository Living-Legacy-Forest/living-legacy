// The face shown for people and team members without a photo: a DiceBear
// "Notionists" drawing seeded by their id, so it never changes when they are
// renamed and no name ends up in a URL. Drawn here rather than by DiceBear's
// web service, so nothing about our people leaves the CMS.
//
// Licences: DiceBear (MIT), Notionists by Zoish (CC0 1.0). No credit needed.
import { createAvatar } from '@dicebear/core';
import * as notionists from '@dicebear/notionists';

// Soft washes that sit with the site: paper, sage, sand, mist and clay. The
// seed picks one, so a person keeps theirs.
const BACKGROUNDS = ['f1ece2', 'dde5d6', 'eadfc8', 'dfe5ea', 'ecdcd3'];

const SEED = /^[\w-]{1,64}$/;

/** Only ids: anything else is refused before it is drawn. */
export const isAvatarSeed = (seed: string) => SEED.test(seed);

export function defaultAvatarSvg(seed: string): string {
  return createAvatar(notionists, {
    seed,
    backgroundColor: BACKGROUNDS,
    backgroundType: ['solid'],
  }).toString();
}
