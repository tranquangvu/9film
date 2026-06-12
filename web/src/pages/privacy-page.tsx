import { LegalPage } from '@/components/system/common/legal-page';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        9film stores only the data needed to power your account: your email, a hashed password, and
        your personal lists, watch progress, and playback settings. Passwords are never stored in
        plain text.
      </p>
      <p>
        Your authentication token is kept in your browser's local storage to keep you signed in.
        We do not sell your data or share it with third parties for advertising.
      </p>
      <p>
        Title metadata, streams, and subtitles are fetched from third-party sources at request
        time. This is a demonstration project; do not store sensitive personal information in it.
      </p>
    </LegalPage>
  );
}
