import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function PatentsDialog() {
  return (
    <Dialog>
      <DialogTrigger className="hover:text-moss-deep underline underline-offset-4 transition-colors duration-300">
        Protected by international patents
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="max-w-sm text-xl">
            Living Legacy's soil treatment process is protected by the following patents
          </DialogTitle>
          <DialogDescription>
            Living Legacy Forest's proprietary ash transformation technology is protected under:
          </DialogDescription>
        </DialogHeader>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-base">
          <li>United States of America Patent No. 10,946,421</li>
          <li>United Kingdom Patent No. GB2561476</li>
          <li>Australian Patent No. 2016358312</li>
        </ul>
        <p className="text-bark text-xs leading-relaxed">
          All brand names and logos are registered trademarks. Unauthorised use is strictly
          prohibited and will be legally enforced.
        </p>
      </DialogContent>
    </Dialog>
  );
}
