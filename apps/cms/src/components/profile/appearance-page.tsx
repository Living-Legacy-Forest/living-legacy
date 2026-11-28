import { SettingsSectionFilter } from '@/components/settings/settings-section';
import { AppearanceSection } from './appearance-section';

/** Your own colour, grain, theme and sidebar, in Settings with everything else. */
export function AppearancePage() {
  return (
    <div data-slot="stack-page" className="mx-auto w-full max-w-3xl">
      <SettingsSectionFilter only="appearance">
        <AppearanceSection />
      </SettingsSectionFilter>
    </div>
  );
}
