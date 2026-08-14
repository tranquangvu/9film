import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/utils/cn';
import { useSettings } from '@/hooks/queries/use-settings-query';
import { SECTION_SIZE } from '@/components/system/learn/section-break';
import { SPELL_TIMES } from '@/components/system/learn/study-deck';
import { TEST_SPELL_COUNT } from '@/components/system/learn/word-test';

type Lang = 'en' | 'vi';

interface Guide {
  title: string;
  description: string;
  steps: { title: string; body: string }[];
}

// The numbers here are read from the components that enforce them rather than
// written out, so the guide can't drift from what the decks actually do.
//
// The Vietnamese version is a retelling, not a word-for-word translation — but it
// keeps the UI's own labels (Study, Completed, Review, Make test, "Got it") in
// English, because that is what the buttons on screen actually say.
const GUIDE: Record<Lang, Guide> = {
  en: {
    title: 'How learning works',
    description: 'Five steps, from a word you just heard to one you never forget.',
    steps: [
      {
        title: 'Collect words while you watch',
        body: 'Tap any word in the subtitles and it lands in your vocabulary, together with the line it came from and the exact moment in the scene — so you can always jump back and hear it again. No time to watch? Import a ready-made pack like the Oxford 3000 instead.',
      },
      {
        title: 'Study until it sticks',
        body: `New words wait in the Study tab. Each card shows the word, its pronunciation and meaning; flip it for definitions and the original scene. Retype the word ${SPELL_TIMES} times to unlock "Got it" — that's what moves it to Completed. Not ready? "Again" drops it to the back of the deck. Sessions run in batches of ${SECTION_SIZE} with a breather in between. Saved idioms skip the typing, since spelling out a whole phrase is punishment, not practice.`,
      },
      {
        title: 'Let spaced repetition do the remembering',
        body: 'The moment a word is learned it gets a review date — the first one tomorrow. Review shows the words due today: recall the meaning, then rate yourself. Again resets it, Hard brings it back sooner, Good pushes it further out, Easy parks it the longest. Rate honestly and the schedule tightens on exactly the words you keep forgetting.',
      },
      {
        title: 'Test yourself for real',
        body: `Make test, on the Completed tab, checks a group properly: memorise the word, watch it vanish, then retype it ${TEST_SPELL_COUNT} times from memory and write what it means. Spelling is marked instantly and the meaning is graded by AI, so a rough-but-right answer still counts. Every score is kept under Test results.`,
      },
      {
        title: 'Keep the streak alive',
        body: 'Your streak counts the days in a row you saved or learned at least one word. Miss a day and it resets — a handful of words beats a marathon once a week.',
      },
    ],
  },
  vi: {
    title: 'Cách học ở đây',
    description: 'Năm bước, từ một từ vừa nghe được thành một từ không quên nữa.',
    steps: [
      {
        title: 'Lưu từ ngay lúc đang xem',
        body: 'Chạm vào bất kỳ từ nào trong phụ đề là nó vào sổ từ của bạn, kèm nguyên câu thoại và đúng khoảnh khắc trong phim — muốn tua lại nghe lúc nào cũng được. Không có thời gian xem? Nhập sẵn một bộ có sẵn như Oxford 3000.',
      },
      {
        title: 'Học tới khi thuộc',
        body: `Từ mới nằm ở tab Study. Mỗi thẻ hiện từ, phiên âm và nghĩa; lật thẻ để xem định nghĩa và cảnh gốc. Gõ lại từ ${SPELL_TIMES} lần để mở "Got it" — đó mới là thứ đẩy từ sang Completed. Chưa thuộc? "Again" trả nó về cuối bộ thẻ. Mỗi phiên chạy theo lô ${SECTION_SIZE} từ, xen giữa là một quãng nghỉ. Thành ngữ đã lưu thì khỏi gõ, vì bắt gõ cả cụm là hành nhau chứ không phải luyện tập.`,
      },
      {
        title: 'Để lặp lại ngắt quãng lo phần nhớ',
        body: 'Ngay khi một từ được đánh dấu đã học, nó có lịch ôn — lần đầu vào ngày mai. Tab Review hiện những từ đến hạn hôm nay: nhớ lại nghĩa rồi tự chấm. Again đặt lại từ đầu, Hard kéo nó về sớm hơn, Good đẩy ra xa hơn, Easy để lâu nhất. Chấm thật lòng thì lịch ôn siết đúng vào những từ bạn hay quên.',
      },
      {
        title: 'Kiểm tra cho ra kiểm tra',
        body: `Make test ở tab Completed kiểm tra một nhóm từ đàng hoàng: ghi nhớ từ, nhìn nó biến mất, rồi gõ lại ${TEST_SPELL_COUNT} lần bằng trí nhớ và viết ra nghĩa của nó. Chính tả chấm ngay, phần nghĩa do AI chấm nên trả lời đúng đại ý vẫn được tính. Mọi điểm số lưu ở Test results.`,
      },
      {
        title: 'Giữ chuỗi ngày',
        body: 'Streak đếm số ngày liên tiếp bạn lưu hoặc học được ít nhất một từ. Nghỉ một ngày là reset — vài từ mỗi ngày ăn đứt một buổi cày cuốc mỗi tuần.',
      },
    ],
  },
};

// "How does this work?" for the learning system — the flow spans four different
// screens (subtitles, Study, Review, Make test), so nothing on any single one of
// them explains the whole loop.
export function LearningGuide() {
  const [open, setOpen] = useState(false);
  const settings = useSettings();
  // Opens in the learner's own language: "translate words to" is the language
  // they think in, which is exactly the one an explanation should arrive in.
  const [lang, setLang] = useState<Lang>(() => (settings.learningLang === 'vi' ? 'vi' : 'en'));
  const guide = GUIDE[lang];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="How learning works"
          className="inline-flex shrink-0 items-center justify-center rounded-full p-1 text-emerald-200/50 transition-colors hover:bg-white/5 hover:text-emerald-100"
        >
          <Info className="h-5 w-5" />
        </button>
      </DialogTrigger>
      {/* Wider and taller than the default dialog: five steps of prose, and at
          max-w-lg they wrap into a column narrow enough that the whole loop no
          longer fits on one screenful. */}
      <DialogContent className="max-w-3xl max-h-[90vh] p-7">
        <DialogTitle>{guide.title}</DialogTitle>
        <DialogDescription className="mt-1">{guide.description}</DialogDescription>

        {/* Under the description rather than up beside the close button: it reads
            in the order it applies — title, what this is, which language it's in,
            then the steps — and stops competing with the X for the corner. */}
        <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 p-0.5">
          {(['en', 'vi'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                lang === l ? 'bg-white/12 text-white' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <ol className="mt-5 space-y-4">
          {guide.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/15 text-xs font-bold text-emerald-300">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
