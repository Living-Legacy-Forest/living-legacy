import { cn } from '@/lib/utils';

export function DashboardSkeleton() {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 lg:grid-cols-4',
        '*:bg-muted *:ring-border *:dark:bg-muted/50 *:min-h-48 *:w-full *:ring-1'
      )}
    >
      <div className="rounded-lg" />
      <div className="rounded-lg" />
      <div className="rounded-lg" />
      <div className="rounded-lg" />
      <div className="col-span-2 min-h-92! rounded-lg lg:col-span-2" />
      <div className="col-span-2 min-h-92! rounded-lg lg:col-span-2" />
      <div className="col-span-2 min-h-114! rounded-lg lg:col-span-4" />
    </div>
  );
}
