import { LegalPage } from '@/components/system/common/legal-page';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        9film is provided "as is" for educational and demonstration purposes, without warranties of
        any kind. By using it you agree that the service may change or be unavailable at any time.
      </p>
      <p>
        You are responsible for keeping your account credentials secure and for any activity under
        your account. Do not use the service for unlawful purposes.
      </p>
      <p>
        9film does not host any video content. Streams and metadata are resolved from third-party
        providers, and availability is outside our control.
      </p>
    </LegalPage>
  );
}
