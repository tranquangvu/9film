import { ShieldAlert, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface WatchNoticeDialogProps {
  open: boolean;
  onAcknowledge: () => void;
}

// The short form of the Disclaimer page, shown once before the first playback
// ever — the moment it actually applies. It has no dismiss affordance beyond
// "I understand" because the whole point is that it was read, and the watch page
// keeps the stream held back until then.
export function WatchNoticeDialog({ open, onAcknowledge }: WatchNoticeDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent dismissible={false}>
        <DialogTitle>Before you press play</DialogTitle>
        <DialogDescription>
          Read this once — it's the whole basis on which this app plays anything.
        </DialogDescription>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <ShieldAlert className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-300">
              9film holds <span className="text-white font-medium">no licence</span> to any film or
              show, and hosts none of them. Every stream, poster and subtitle is fetched at request
              time from public third-party sources and passed straight through to your browser.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <GraduationCap className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-300">
              It is a <span className="text-white font-medium">personal, non-commercial</span>{' '}
              project for language learning, with no affiliation to any studio or streaming service.
              Whether a title is legal to watch where you are is your call to make, not ours.
            </p>
          </div>
        </div>

        {/* New tab, not a route change: navigating away here would tear down the
            player the notice is standing in front of. */}
        <p className="mt-4 text-xs text-zinc-500">
          The full terms live on the{' '}
          <a
            href="/disclaimer"
            target="_blank"
            rel="noreferrer"
            className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
          >
            Disclaimer page
          </a>
          .
        </p>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" size="sm" className="rounded-lg" onClick={onAcknowledge}>
            I understand
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
