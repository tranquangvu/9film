import { LegalPage } from '@/components/system/common/legal-page';

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer">
      <p>
        9film does not host, upload, or store any films, TV shows, or media files on its own
        servers. All metadata, streams, and subtitles are retrieved from publicly accessible
        third-party sources.
      </p>
      <p>
        This project exists solely to demonstrate web and streaming technologies. It is not
        intended for commercial use or for distributing copyrighted material.
      </p>
      <p>
        Any trademarks, posters, and titles referenced belong to their respective owners.
      </p>
    </LegalPage>
  );
}
