import DocsLayout, { DocSection } from "../../components/DocsLayout";

export default function Privacy() {
  return (
    <DocsLayout
      title="Privacy Policy"
      subtitle="We are an early-stage startup. This policy is written plainly and honestly. We do not sell your data, we do not use dark patterns, and we will not pretend to have infrastructure we do not have yet."
      effectiveDate="May 9, 2026"
    >
      <DocSection number="01" title="Who We Are">
        <p>
          LinguaMic is an AI-powered voice platform providing text-to-speech, speech-to-text, and voice translation
          services. We are founded by Abhishek and Vikashdeep, based in India, building for a global audience.
        </p>
        <p>
          Contact:{" "}
          <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600">
            company@linguamic.com
          </a>
        </p>
      </DocSection>

      <DocSection number="02" title="What We Collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account information</strong> - name, email address, password when you register.
          </li>
          <li>
            <strong>Payment information</strong> - we do not store your card details.
          </li>
          <li>
            <strong>Usage data</strong> - credits consumed, features used, session duration. This helps us improve the
            product.
          </li>
          <li>
            <strong>Text inputs</strong> - text you submit for TTS generation. We do not permanently store your text
            inputs after audio is generated unless you explicitly save them.
          </li>
          <li>
            <strong>Audio outputs</strong> - generated audio files are stored temporarily for download. We do not use your
            generated audio to train models.
          </li>
          <li>
            <strong>Device and technical data</strong> - browser type, IP address, device information for security and
            performance purposes.
          </li>
          <li>
            <strong>Communications</strong> - if you contact us by email we retain that communication to respond to you.
          </li>
        </ul>
      </DocSection>

      <DocSection number="03" title="What We Do Not Collect">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-neutral-700">
          <p>We do not collect your voice recordings unless you use the STT feature.</p>
          <p>We do not sell your data. Ever.</p>
          <p>We do not share your data with advertisers.</p>
        </div>
      </DocSection>

      <DocSection number="04" title="How We Use Your Data">
        <ul className="list-disc space-y-2 pl-5">
          <li>To provide and improve LinguaMic's services.</li>
          <li>To manage your account and credits.</li>
          <li>To process payments and manage subscriptions.</li>
          <li>To send transactional emails - account confirmation, renewal reminders, credit updates.</li>
          <li>To send product updates occasionally - you can unsubscribe anytime.</li>
          <li>To detect fraud and ensure platform security.</li>
        </ul>
      </DocSection>

      <DocSection number="05" title="Auto-Pay and Payment Data">
        <p>
          When you enable an auto-pay mandate for monthly subscriptions, your payment details are stored securely by our
          payment processors. LinguaMic does not store your card or bank details directly. You can cancel your auto-pay
          mandate anytime from your account settings.
        </p>
      </DocSection>

      <DocSection number="06" title="Free Credits">
        <p>
          All users receive 10,000 free credits monthly. No payment information is required to access your free credits.
          We collect only your email address and account information for free tier users.
        </p>
      </DocSection>

      <DocSection number="07" title="Open Source and Third Party Services">
        <p>LinguaMic uses the following third party services:</p>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
          <p>Orpheus TTS (Canopy Labs) - powers voice generation, Apache 2.0 license.</p>
          <p>Whisper (OpenAI) - powers speech transcription.</p>
          <p>MongoDB - database hosting.</p>
          <p>Cloudflare - content delivery and security.</p>
        </div>
        <p>Each third party operates under their own privacy policy.</p>
      </DocSection>

      <DocSection number="08" title="Data Retention">
        <p>
          We retain your account data for as long as your account is active. If you delete your account we will delete
          your personal data within 30 days. Generated audio files are stored temporarily and deleted within 7 days unless
          you save them to your account.
        </p>
      </DocSection>

      <DocSection number="09" title="Your Rights">
        <p>Regardless of where you are located you have the right to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Access the data we hold about you.</li>
          <li>Request deletion of your account and data.</li>
          <li>Correct inaccurate information.</li>
          <li>Export your data.</li>
          <li>Unsubscribe from marketing emails at any time.</li>
        </ul>
        <p>
          To exercise any of these rights email{" "}
          <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600">
            company@linguamic.com
          </a>
          . We respond within 3 days.
        </p>
      </DocSection>

      <DocSection number="10" title="Children's Privacy">
        <p>
          LinguaMic is available to users aged 13 and above. Users under 18 require parental consent to make purchases.
          We do not knowingly collect personal data from children under 13.
        </p>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          If you believe a child under 13 has created an account please contact us immediately at{" "}
          <a href="mailto:privacy@linguamic.com" className="text-orange-500 hover:text-orange-600">
            privacy@linguamic.com
          </a>
          .
        </div>
      </DocSection>

      <DocSection number="11" title="Security">
        <p>
          We are a small early-stage team. We take reasonable precautions - encrypted connections, secure database
          hosting, limited internal access to user data. We do not claim enterprise-grade security infrastructure. If we
          become aware of a breach affecting your data we will notify you within 72 hours.
        </p>
      </DocSection>

      <DocSection number="12" title="International Users">
        <p>
          LinguaMic serves users globally. By using LinguaMic you consent to your data being processed in India where our
          servers and team are based. We handle international data in compliance with applicable regulations.
        </p>
      </DocSection>

      <DocSection number="13" title="Changes to This Policy">
        <p>
          We will notify you by email before any material changes take effect. We will not retroactively change how we
          use data you have already provided.
        </p>
      </DocSection>

      <DocSection number="14" title="Contact">
        <p>
          <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600">
            company@linguamic.com
          </a>
        </p>
        <p className="italic text-sm text-neutral-500">We are real people and we will respond personally.</p>
      </DocSection>
    </DocsLayout>
  );
}
