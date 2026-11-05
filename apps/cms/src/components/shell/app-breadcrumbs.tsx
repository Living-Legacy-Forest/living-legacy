import { Link } from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { type NavItem, navItemIcon } from '@/lib/nav';

/**
 * Current location in the header. On a page below a nav item (for example a
 * post being edited) the nav item becomes a link back, followed by `current`.
 */
export function AppBreadcrumbs({ item, current }: { item?: NavItem; current?: string }) {
  if (!item) return null;
  const Icon = navItemIcon(item);

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[13px]">
        <BreadcrumbItem>
          {current && item.to ? (
            <BreadcrumbLink
              render={<Link to={item.to} activeOptions={{ exact: true }} />}
              className="flex items-center gap-2"
            >
              {Icon && <Icon aria-hidden className="size-4" />}
              {item.title}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="flex items-center gap-2">
              {Icon && <Icon aria-hidden className="size-4" />}
              {item.title}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {current && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{current}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
