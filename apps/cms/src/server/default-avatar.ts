// The drawn avatars people choose from (components/avatar-picker.tsx): a
// DiceBear "Notionists" face for a random seed, which is what gets stored.
// Nobody is given one automatically; without a photo or a choice, initials
// show. Drawn here rather than by DiceBear's web service, so nothing about
// our people leaves the CMS.
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
