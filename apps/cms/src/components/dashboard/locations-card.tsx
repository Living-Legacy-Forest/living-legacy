import { type LocationStage, locationStages } from '@ll/content';
import { Link, useNavigate } from '@tanstack/react-router';
import { LocationsOverviewMap } from '@/components/locations/location-map';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { DashboardData } from '@/server/dashboard';

/** How the footer counts each stage, e.g. "3 coming soon". */
const stageCount: Record<LocationStage, (n: number) => string> = {
  live: (n) => `${n} with a page on this website`,
  external: (n) => `${n} with ${n === 1 ? 'its' : 'their'} page on another website`,
  coming_soon: (n) => `${n} coming soon`,
};

/** Every pinned location on one map; a pin opens that location in Locations. */
export function LocationsCard({ locations }: { locations: DashboardData['locations'] }) {
  const navigate = useNavigate();
  const byStage = locationStages
    .map((stage) => ({ stage, count: locations.filter((l) => l.stage === stage).length }))
    .filter((s) => s.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Locations</CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="ghost"

            render={<Link to="/locations" />}
            nativeButton={false}
          >
            View all
          </Button>
        </CardAction>
      </CardHeader>
      {/* The map grows to match the card beside it. */}
      <CardContent className="flex-1">
        <div className="h-full min-h-72 overflow-hidden rounded-lg">
          <LocationsOverviewMap
            locations={locations.map((l) => ({
              id: l.id,
              name: l.name,
              pin:
                l.latitude !== null && l.longitude !== null
                  ? { latitude: l.latitude, longitude: l.longitude }
                  : null,
              photoUrl: l.heroMediaId ? `/api/media/${l.heroMediaId}?w=640` : null,
            }))}
            selectedId={null}
            onSelect={(id) => navigate({ to: '/locations', search: { selected: id } })}
          />
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        {locations.length === 0
          ? 'No locations yet.'
          : byStage.map((s) => stageCount[s.stage](s.count)).join(' · ')}
      </CardFooter>
    </Card>
  );
}
