import { LegalPage } from '@/components/system/common/legal-page';

export default function AboutPage() {
  return (
    <LegalPage title="About 9film">
      <p>
        9film is a demo streaming experience that lets you browse rich movie and TV metadata and
        play titles by their IMDb id. It pairs a React frontend with a lightweight Go proxy that
        handles metadata, stream resolution, and subtitles.
      </p>
      <p>
        Create an account to build your list of favorites and watch-later titles, pick up where you
        left off with Continue Watching, and tune playback defaults like subtitle language and
        video quality.
      </p>
      <p>
        This project is for educational and demonstration purposes only and is not affiliated with
        any streaming service or content provider.
      </p>
    </LegalPage>
  );
}
