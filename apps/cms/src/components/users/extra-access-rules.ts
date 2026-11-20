// What the extra-access checklist shows and how ticking behaves. Kept free of React and UI
// so it runs under plain Node tests. It only shapes what an admin sees and sends; the
// server decides what a person may actually do.
import {
  can,
  grantablePermissions,
  permissionRequires,
  withRequiredPermissions,
  type Permission,
  type Role,
} from '@ll/content';

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  author: 'Author',
  seo: 'SEO',
  viewer: 'Viewer',
};

type Item = { permission: Permission; label: string; hint?: string };

// Labels are the comments beside each permission in roles.ts, as short plain sentences.
export const extraAccessGroups: readonly { heading: string; items: readonly Item[] }[] = [
  {
    heading: 'Posts',
    items: [
      {
        permission: 'posts:write',
        label: 'Write and edit posts',
        hint: 'Saved as drafts. Authors can only change their own.',
      },
      {
        permission: 'posts:publish',
        label: 'Publish and manage posts',
        hint: 'Publish, schedule, unpublish, trash and restore posts, and edit anyone’s.',
      },
    ],
  },
  {
    heading: 'SEO',
    items: [
      {
        permission: 'seo:write',
        label: 'Edit SEO fields',
        hint: 'A post’s SEO fields and the search and sharing settings.',
      },
      { permission: 'redirects:write', label: 'Edit redirects' },
    ],
  },
  {
    heading: 'Content',
    items: [
      {
        permission: 'content:write',
        label: 'Edit FAQs, testimonials, team and announcements',
        hint: 'Also post categories.',
      },
      {
        permission: 'content:purge',
        label: 'Delete content for good',
        hint: 'From the trash, and media.',
      },
      {
        permission: 'content:replace',
        label: 'Search and replace across all content',
        hint: 'Changes many pages at once.',
      },
    ],
  },
  {
    heading: 'Events',
    items: [
      {
        permission: 'events:manage',
        label: 'Manage events and guest lists',
        hint: 'Guest lists hold names, emails and phone numbers.',
      },
    ],
  },
  { heading: 'Media', items: [{ permission: 'media:write', label: 'Upload and edit media' }] },
  {
    heading: 'Other',
    items: [
      { permission: 'settings:write', label: 'Change settings' },
      { permission: 'legal:publish', label: 'Publish legal pages' },
    ],
  },
];

const labelOf = new Map<Permission, string>(
  extraAccessGroups.flatMap((group) => group.items.map((i) => [i.permission, i.label] as const))
);

const grantable = new Set<Permission>(grantablePermissions);

// Kept in the order of the permission list so a saved list does not depend on click order.
function inOrder(list: Iterable<Permission>): Permission[] {
  const wanted = new Set(list);
  return grantablePermissions.filter((permission) => wanted.has(permission));
}

const roleHas = (role: Role, permission: Permission) => can({ role }, permission);

// Said beside a permission that is ticked only because another one needs it. Keyed by the
// permission that needs it.
const neededNotes: Partial<Record<Permission, string>> = {
  'posts:publish': 'Needed to publish',
  'legal:publish': 'Needed to publish legal pages',
  'settings:write': 'Needed to change settings',
};

/**
 * The selected (or role-held) permission that needs this one, when the role itself does not
 * have this one: without it, that permission would sit there doing nothing.
 */
function neededBy(role: Role, extras: readonly Permission[], permission: Permission) {
  if (roleHas(role, permission)) return undefined;
  return grantablePermissions.find(
    (dependent) =>
      permissionRequires[dependent] === permission &&
      (extras.includes(dependent) || roleHas(role, dependent))
  );
}

export function splitExtras(role: Role, selected: readonly Permission[]) {
  const chosen = inOrder(selected);
  if (role === 'admin') return { included: chosen, extras: [] as Permission[] };
  return {
    included: chosen.filter((permission) => roleHas(role, permission)),
    extras: chosen.filter((permission) => !roleHas(role, permission)),
  };
}

export function permissionState(role: Role, extras: readonly Permission[], permission: Permission) {
  if (roleHas(role, permission)) {
    return { checked: true, locked: true, note: `Included in ${roleLabels[role]}` };
  }
  const dependent = neededBy(role, extras, permission);
  if (dependent) {
    return {
      checked: true,
      locked: true,
      note: neededNotes[dependent] ?? 'Needed for another permission',
    };
  }
  return { checked: extras.includes(permission), locked: false, note: null };
}

/** The extras after one box is ticked or unticked. */
export function applyExtraChange(
  role: Role,
  current: readonly Permission[],
  permission: Permission,
  checked: boolean
): Permission[] {
  const extras = splitExtras(role, current).extras;
  if (!grantable.has(permission) || roleHas(role, permission)) return extras;
  if (checked) {
    return splitExtras(role, withRequiredPermissions([...extras, permission])).extras;
  }
  if (neededBy(role, extras, permission)) return extras;
  return inOrder(extras.filter((p) => p !== permission));
}

/** What to save for a person: only real extras, with whatever each one needs alongside it. */
export function normaliseExtras(role: Role, selected: readonly Permission[]): Permission[] {
  return splitExtras(role, withRequiredPermissions(splitExtras(role, selected).extras)).extras;
}

/** The extras as a short line for a list row. */
export function describeExtras(extras: readonly Permission[]): string {
  return extras.map((permission) => labelOf.get(permission) ?? permission).join(', ');
}

export function invitePayload(email: string, role: Role, selected: readonly Permission[]) {
  return { email, role, extraPermissions: normaliseExtras(role, selected) };
}

/** Inviting an email again replaces its invitation, so a resend must carry the extras along. */
export function resendPayload(invite: {
  email: string;
  role: Role;
  extraPermissions: readonly Permission[];
}) {
  return invitePayload(invite.email, invite.role, invite.extraPermissions);
}
