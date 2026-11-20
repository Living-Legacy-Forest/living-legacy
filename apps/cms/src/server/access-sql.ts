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

  // CASE rather than AND: SQLite may evaluate both sides, and json_each throws
  // on malformed JSON, which would fail the query for every row.
  const byExtra = sql`CASE WHEN json_valid(${user.extraPermissions})
    THEN EXISTS (SELECT 1 FROM json_each(${user.extraPermissions}) WHERE value = ${permission})
    ELSE 0 END`;
  return or(byRole, byExtra)!;
}
