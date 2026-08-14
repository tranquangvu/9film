import { Link } from 'react-router-dom';
import { PageGradient } from '@/components/system/common/gradient';

// What the app is and how to get the most out of it. The legal side (whose
// video this is, where your data lives) lives on /disclaimer.
export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background pt-24 pb-16 px-4 md:px-8 lg:px-12">
      {/* Cool slate rather than the orange of the home hero: the two static
          pages are read, not browsed, and share a wash of their own. */}
      <PageGradient className="from-slate-800/40" />

      <div className="relative max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">About 9film</h1>

        <div className="space-y-8 text-zinc-300 leading-relaxed text-sm md:text-base">
          <section className="space-y-4">
            <p className="text-base md:text-lg text-white">
              9film turns the films and series you already want to watch into English practice.
            </p>
            <p>
              Subtitles are the best English lesson most people never use: real dialogue, spoken at
              real speed, about something you actually care about. 9film puts a full player and a
              vocabulary workshop in the same place, so looking a word up costs you one click
              instead of a detour to another app.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">Watch</h2>
            <p>
              Browse popular, trending and newly released titles, search by name, or open any IMDb
              id directly. Pick a stream, choose a subtitle track, and jump between seasons and
              episodes from the player itself. Your list and your resume point are remembered, so
              Continue Watching drops you back exactly where you stopped.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">Learn</h2>
            <p>
              Turn on the transcript to read along with the dialogue. Click any word to see its
              definition, pronunciation and translation, then save it — the line it came from and
              the timestamp are saved with it, so a word you review later still carries the scene
              that taught it. Phrases and idioms get an explanation of what they actually mean
              rather than a word-by-word translation.
            </p>
            <p>
              Saved words feed the rest: spelling and meaning self-tests, spaced-repetition reviews
              scheduled by the SM-2 algorithm, progress insights, and the Oxford 3000 list to track
              the core vocabulary you've covered.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">How it's built</h2>
            <p>
              A React frontend talks to a small Go service that fetches metadata from IMDb, resolves
              streams, proxies the HLS playlists, and searches subtitles. Two features are optional
              and ask for a key only when you first use them: SubDL for subtitles, and a Gemini key
              for phrase explanations and AI-graded test answers. Without them the rest still works
              — you're just missing captions, or you get a plain translation instead of a breakdown.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-white">Before you watch</h2>
            <p>
              9film hosts no video and owns no rights to any of it, and everything you save stays on
              your own machine. The details are on the{' '}
              <Link to="/disclaimer" className="text-orange-400 hover:text-orange-300 transition-colors">
                disclaimer
              </Link>{' '}
              page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
