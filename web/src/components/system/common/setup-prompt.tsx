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
        <DialogTitle>Optional: unlock more of NiceFilm</DialogTitle>
        <DialogDescription>
          These two features use your own free API keys. They're completely optional — NiceFilm works
          without them, and you can add them anytime from your profile.
        </DialogDescription>

        <div className="mt-4 space-y-3">
          {needsSubs && (
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Captions className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Subtitles &amp; Learn-English mode <span className="font-normal text-zinc-500">· optional</span>
                </p>
                <p className="text-xs text-zinc-400">
                  An OpenSubtitles key lets NiceFilm find and download captions for any title, and powers
                  Learn-English mode — where each subtitle line becomes clickable to look up words, save
                  vocabulary, and translate sentences.
                </p>
                <p className="mt-1.5 text-xs text-amber-300/80">
                  Without it: no captions and Learn-English mode is unavailable. Video still plays normally.
                </p>
              </div>
            </div>
          )}
          {needsGemini && (
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Sparkles className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Word illustrations &amp; smarter learning <span className="font-normal text-zinc-500">· optional</span>
                </p>
                <p className="text-xs text-zinc-400">
                  A Gemini key generates a small AI "memory picture" for each vocabulary word, explains
                  idioms and phrasal verbs, and grades your meaning self-tests with real feedback.
                </p>
                <p className="mt-1.5 text-xs text-amber-300/80">
                  Without it: saved words have no picture, phrase breakdowns fall back to a plain translation,
                  and meaning tests use offline grading. Definitions, translations, spelling tests and review
                  still work.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={close}>
            Skip for now
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
