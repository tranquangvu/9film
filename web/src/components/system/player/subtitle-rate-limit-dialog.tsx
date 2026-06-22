import { useNavigate } from 'react-router-dom';
import { Captions } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface SubtitleRateLimitDialogProps {
  open: boolean;
  onClose: () => void;
}

// Shown on the watch page when the shared OpenSubtitles account gets
// rate-limited and the user hasn't added their own keys. Nudges them to enter
// their own credentials in profile settings to keep downloading subtitles.
export function SubtitleRateLimitDialog({ open, onClose }: SubtitleRateLimitDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Subtitles temporarily unavailable</DialogTitle>
        <DialogDescription>
          The shared OpenSubtitles account just hit its rate limit, so this subtitle couldn't be downloaded.
        </DialogDescription>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <Captions className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">
            Add your own OpenSubtitles <span className="font-semibold text-white">API key</span>,{' '}
            <span className="font-semibold text-white">username</span>, and{' '}
            <span className="font-semibold text-white">password</span> in profile settings to download subtitles
            without limits.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose}>
            Maybe later
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="rounded-lg"
            onClick={() => {
              onClose();
              navigate('/profile');
            }}
          >
            Add keys
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
