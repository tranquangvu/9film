import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import { KEY_COPY } from '@/components/system/common/key-copy';

interface SubtitleKeyNoticeProps {
  open: boolean;
  onDismiss: () => void;
}

// Shown over the player when the subtitle search came back "no key stored": the
// onboarding flow already offered the key and was skipped, so this is a reminder
// of *why* the subtitle picker is empty, not a second ask. It sits beside the
// video rather than in front of it — playback is unaffected, so nothing here
// should interrupt it.
export function SubtitleKeyNotice({ open, onDismiss }: SubtitleKeyNoticeProps) {
  const navigate = useNavigate();
  if (!open) return null;

  const copy = KEY_COPY.subdl;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute top-20 inset-x-4 z-50 pointer-events-auto sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[26rem]"
    >
      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/90 px-4 py-3 shadow-2xl backdrop-blur">
        <copy.icon className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">No subtitles for this title</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{copy.why}</p>
          <div className="mt-2.5 flex items-center gap-4">
            <button
              onClick={() => navigate('/profile')}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 cursor-pointer"
            >
              Add a key
            </button>
            <a
              href={copy.href}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"
            >
              Get one free <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
