import { type Permission, grantablePermissions, rolesGranting } from '@ll/content';
import { user } from '@ll/db/schema';
import { type SQL, inArray, or, sql } from 'drizzle-orm';

/**
 * Rows of `user` who hold a permission: through their role, or (for the
 * permissions an admin may hand out) through their `extra_permissions` list.
 * The SQL twin of `can(toAccess(row), permission)`, for picking people in a
 * query rather than loading every row.
 */
export function hasPermissionSql(permission: Permission): SQL {
  const byRole = inArray(user.role, rolesGranting(permission));
  if (!(grantablePermissions as readonly Permission[]).includes(permission)) return byRole;

  // Nested CASEs rather than AND: SQLite may evaluate both sides, and json_type
  // and json_each throw on malformed JSON, which would fail the query for every
  // row. Only an array counts, as parseExtraPermissions treats anything else as
  // empty; json_each would otherwise match a bare string or an object's values.
  const byExtra = sql`CASE WHEN json_valid(${user.extraPermissions})
    THEN (CASE WHEN json_type(${user.extraPermissions}) = 'array'
      THEN EXISTS (SELECT 1 FROM json_each(${user.extraPermissions}) WHERE value = ${permission})
      ELSE 0 END)
    ELSE 0 END`;
  return or(byRole, byExtra)!;
}
