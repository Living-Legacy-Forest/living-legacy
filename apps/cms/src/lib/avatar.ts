// What a person shows: their uploaded photo, else the drawn avatar they chose
// (server/default-avatar.ts), else nothing, so the avatar falls back to their
// initials. Nobody is given a drawn face they did not pick.

const SEED = /^[\w-]{1,64}$/;

export const avatarUrl = (seed: string) => `/api/avatars/${seed}`;

export function avatarSrc(person: {
  image?: string | null;
  avatarSeed?: string | null;
}): string | undefined {
  if (person.image) return person.image;
  if (person.avatarSeed && SEED.test(person.avatarSeed)) return avatarUrl(person.avatarSeed);
  return undefined;
}

/** Fresh seeds for the avatar picker: each draws a different face. */
export function randomAvatarSeeds(count: number): string[] {
  const seeds = new Set<string>();
  while (seeds.size < count) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    seeds.add(Array.from(bytes, (b) => (b % 36).toString(36)).join(''));
  }
  return [...seeds];
}

/** Up to two initials, for when there is no picture. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
