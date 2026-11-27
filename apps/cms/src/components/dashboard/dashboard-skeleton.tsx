import { cn } from '@/lib/utils';

export function DashboardSkeleton() {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4',
        '*:bg-muted *:dark:bg-muted/50 *:min-h-48 *:w-full'
      )}
    >
      <div className="rounded-lg" />
      <div className="rounded-lg" />
      <div className="rounded-lg" />
      <div className="rounded-lg" />
      <div className="min-h-92! rounded-lg md:col-span-2 lg:col-span-2" />
      <div className="min-h-92! rounded-lg md:col-span-2 lg:col-span-2" />
      <div className="min-h-114! rounded-lg md:col-span-2 lg:col-span-4" />
    </div>
  );
}
