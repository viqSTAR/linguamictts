import DocsLayout, { DocSection } from "../../components/DocsLayout";

export default function Privacy() {
  return (
    <DocsLayout
      title="Privacy Policy"
      subtitle="We are an early-stage startup. This policy is written plainly and honestly. We do not sell your data, we do not use dark patterns, and we will not pretend to have infrastructure we do not have yet."
      effectiveDate="May 16, 2026"
    >
      <DocSection number="01" title="Who We Are">
        <p>
          LinguaMic is an AI-powered voice platform providing text-to-speech (TTS) and speech-to-text (STT) services.
          We are founded by Abhishek and Vikashdeep, based in India, building for a global audience.
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
            <strong>Account information</strong> - name, email address, and a hashed password when you register.
          </li>
          <li>
            <strong>Google sign-in profile</strong> - if you sign in with Google, we receive your email, name, and
            profile picture from Google. We never receive your Google password.
          </li>
          <li>
            <strong>Payment information</strong> - handled by our payment processor. We do not store your card or bank
            details. We retain a payment processor customer ID so saved cards persist between purchases.
          </li>
          <li>
            <strong>Usage data</strong> - credits consumed per request, characters generated, emotion tags used, and
            tone selection. This helps us improve the product.
          </li>
          <li>
            <strong>Text inputs</strong> - text you submit for TTS generation. We do not retain the text after the audio
            has been generated.
          </li>
          <li>
            <strong>Audio inputs</strong> - audio files you submit to the speech-to-text endpoint. These are processed
            in-memory and deleted immediately after transcription. We do not retain them.
          </li>
          <li>
            <strong>Generated audio</strong> - we store only your <em>most recently generated</em> audio clip so you can
            re-download it from Studio. As soon as you generate a new clip, the previous one is deleted from our
            storage.
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
          <p>We do not collect your voice recordings except for the moments your STT upload is being transcribed.</p>
          <p>We do not sell your data. Ever.</p>
          <p>We do not share your data with advertisers.</p>
          <p>We do not use your generated audio or submitted text to train our models.</p>
        </div>
      </DocSection>

      <DocSection number="04" title="How We Use Your Data">
        <ul className="list-disc space-y-2 pl-5">
          <li>To provide and improve LinguaMic&apos;s services.</li>
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
          payment processor. LinguaMic does not store your card or bank details directly. You can cancel your auto-pay
          mandate anytime from your account dashboard.
        </p>
      </DocSection>

      <DocSection number="06" title="Free Credits">
        <p>
          Every new account starts with 12,000 free credits for the first month. After that, every account - free or
          paid - receives 10,000 free credits at the start of each calendar month, indefinitely. No payment information
          is required to use your free credits.
        </p>
      </DocSection>

      <DocSection number="07" title="Third Party Services">
        <p>LinguaMic relies on the following categories of third-party providers to deliver our service:</p>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
          <p>Payment processing - secure billing, subscription management, and refunds.</p>
          <p>Database hosting - encrypted storage of account and usage data.</p>
          <p>Object storage - storing your most recent generated audio for download.</p>
          <p>Identity provider - Google Sign-In (optional, only if you choose it).</p>
          <p>Content delivery and security - global edge network and DDoS protection.</p>
          <p>Email delivery - transactional notifications and account communications.</p>
          <p>GPU compute - running our speech models.</p>
        </div>
        <p>Each provider operates under their own privacy policy and is bound by data processing agreements where applicable.</p>
      </DocSection>

      <DocSection number="08" title="Data Retention">
        <p>
          We retain your account and usage data for as long as your account is active. If you delete your
          account we will delete your personal data within 30 days.
        </p>
        <p>
          Generated audio is stored only as your &quot;most recent clip&quot; - the previous clip is overwritten and
          deleted from our storage every time you generate a new one. We do not keep a history of your generations.
          Audio submitted to speech-to-text is deleted immediately after the transcript is returned.
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
          <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600">
            company@linguamic.com
          </a>
          .
        </div>
      </DocSection>

      <DocSection number="11" title="Security">
        <p>
          We are a small early-stage team. We take reasonable precautions - HTTPS-only traffic, hashed passwords,
          scoped database access, signed payment webhooks, and limited internal access to user data. We do not
          claim enterprise-grade security infrastructure. If we become aware of a breach affecting your data we will
          notify you within 72 hours.
        </p>
      </DocSection>

      <DocSection number="12" title="International Users">
        <p>
          LinguaMic serves users globally. Our primary servers and team are based in India. Some of our service
          providers (payment processor, object storage, database host) operate in the US and EU, which means your data
          may be processed in those regions as well. By using LinguaMic you consent to your data being processed in
          these locations. We handle international data in compliance with applicable regulations.
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
