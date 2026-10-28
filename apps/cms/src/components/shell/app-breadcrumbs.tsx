import { Link } from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { NavItem } from '@/lib/nav';

/**
 * Current location in the header. On a page below a nav item (for example a
 * post being edited) the nav item becomes a link back, followed by `current`.
 */
export function AppBreadcrumbs({ item, current }: { item?: NavItem; current?: string }) {
  if (!item) return null;
  const Icon = item.icon;

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[13px]">
        <BreadcrumbItem>
          {current && item.to ? (
            <BreadcrumbLink render={<Link to={item.to} />}>{item.title}</BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="flex items-center gap-2 [&>svg]:size-3.5">
              {Icon && <Icon aria-hidden />}
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
