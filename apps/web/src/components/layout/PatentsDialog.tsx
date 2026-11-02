import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PATENTS = [
  { country: 'Australia', number: '2016358312' },
  { country: 'United States', number: '10,946,421' },
  { country: 'United Kingdom', number: 'GB2561476' },
];

export default function PatentsDialog() {
  return (
    <Dialog>
      <DialogTrigger className="hover:text-moss-deep underline underline-offset-4 transition-colors duration-300">
        Protected by international patents
      </DialogTrigger>
      <DialogContent className="gap-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Our patents</DialogTitle>
          <DialogDescription>
            Living Legacy's soil treatment process for ashes is patented in three countries.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-bark/15 border-bark/15 divide-y border-y text-base">
          {PATENTS.map((patent) => (
            <div key={patent.country} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-soft">{patent.country}</dt>
              <dd className="text-ink font-medium tabular-nums">{patent.number}</dd>
            </div>
          ))}
        </dl>
        <p className="text-bark text-xs leading-relaxed">
          All brand names and logos are registered trademarks. Unauthorised use is strictly
          prohibited and will be legally enforced.
        </p>
      </DialogContent>
    </Dialog>
  );
}
