import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Captions } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/context/auth-context';
import { useCredentialsQuery } from '@/hooks/queries/use-credentials-query';

const DISMISS_KEY = 'nicefilm_setup_dismissed';

// Shown once per session after sign-in when an optional integration has no key,
// explaining why it's useful and linking to Connections. Fully dismissable.
export function SetupPrompt() {
  const { isAuthenticated } = useAuth();
  const { data: status, isSuccess } = useCredentialsQuery();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === '1');

  const needsGemini = isSuccess && status && !status.geminiConfigured;
  const needsSubs = isSuccess && status && !status.openSubtitlesConfigured;
  const open = isAuthenticated && !dismissed && !!(needsGemini || needsSubs);

  const close = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogTitle>Unlock more of NiceFilm</DialogTitle>
        <DialogDescription>
          Optional free API keys — add anytime from your profile.
        </DialogDescription>

        <div className="mt-5 space-y-2">
          {needsSubs && (
            <FeatureRow
              icon={Captions}
              title="Subtitles & Learn-English"
              desc="Clickable captions, word lookups & translation"
            />
          )}
          {needsGemini && (
            <FeatureRow
              icon={Sparkles}
              title="Smarter learning"
              desc="AI word pictures, idiom help & graded tests"
            />
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={close}>
            Maybe later
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="rounded-lg"
            onClick={() => {
              close();
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

function FeatureRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Sparkles;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
      <span className="grid place-items-center w-9 h-9 shrink-0 rounded-lg bg-orange-500/10">
        <Icon className="w-[18px] h-[18px] text-orange-400" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">{title}</p>
        <p className="text-xs text-zinc-400 leading-tight mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
