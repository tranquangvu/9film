import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { KEY_COPY, type KeyKind } from '@/components/system/common/key-copy';

interface MissingKeyDialogProps {
  kind: KeyKind;
  open: boolean;
  onClose: () => void;
}

// Shown the first time in a session that a feature is used whose API key isn't
// set — the onboarding flow asked for both up front, so this only ever catches a
// key that was skipped there. It informs and offers a shortcut to Connections;
// dismissing leaves the feature off, not broken. The watch page uses the quieter
// SubtitleKeyNotice instead, since nothing there is waiting on an answer.
export function MissingKeyDialog({ kind, open, onClose }: MissingKeyDialogProps) {
  const navigate = useNavigate();
  const copy = KEY_COPY[kind];
  const Icon = copy.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>
          {copy.feature} needs a {copy.provider} key
        </DialogTitle>
        <DialogDescription>{copy.why}</DialogDescription>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <Icon className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-sm text-zinc-300">
            {copy.without}{' '}
            <a
              href={copy.href}
              target="_blank"
              rel="noreferrer"
              className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
            >
              {copy.linkLabel}
            </a>
            , then paste it into Account → Connections.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose}>
            Not now
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
            Add key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
