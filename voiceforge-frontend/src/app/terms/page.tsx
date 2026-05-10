import DocsLayout, { DocSection } from "../../components/DocsLayout";

export default function Terms() {
  return (
    <DocsLayout
      title="Terms and Conditions"
      subtitle="By accessing or using LinguaMic you agree to these terms. If you do not agree, do not use the service."
      effectiveDate="May 9, 2026"
    >
      <DocSection number="01" title="The Service">
        <p>
          LinguaMic provides AI voice generation (TTS), speech transcription (STT), and voice translation tools through
          a web-based platform. Access is granted upon payment of applicable subscription or credit fees.
        </p>
      </DocSection>

      <DocSection number="02" title="Eligibility">
        <p>You must be at least 13 years old to use LinguaMic. By using the service you confirm you meet this requirement.</p>
      </DocSection>

      <DocSection number="03" title="Credits and Subscriptions">
        <p>
          LinguaMic operates on a credit-based system. Credits are consumed when you use TTS or STT features. We offer the
          following plans:
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="text-sm font-semibold text-neutral-900">Monthly Subscriptions</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>Starter - 45,000 credits for $4.99/month</li>
              <li>Creator - 210,000 credits for $18.99/month</li>
              <li>Pro - 859,000 credits for $79.99/month</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="text-sm font-semibold text-neutral-900">Pay As You Go</p>
            <p className="mt-3 text-sm text-neutral-600">5,000 credits per $1.00</p>
          </div>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-neutral-700">
          However users will receive a total of 10k free credits per month.
        </div>
        <p>
          Monthly subscription credits reset at the start of each billing cycle. Unused credits do not carry over. Pay As
          You Go credits do not expire.
        </p>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          Users under 18 are required to take parental consent before making any purchases on LinguaMic.
        </div>
      </DocSection>

      <DocSection number="04" title="Acceptable Use">
        <p>
          You agree not to use LinguaMic to generate content that is illegal, harmful, defamatory, or violates the rights
          of others. You agree not to use the platform to impersonate real people without consent, generate voice clones
          of individuals without their permission, or attempt to reverse engineer the underlying technology.
        </p>
      </DocSection>

      <DocSection number="05" title="Intellectual Property">
        <p>
          Audio generated using LinguaMic may be used for personal and commercial purposes. LinguaMic retains no ownership
          of your generated content. The LinguaMic name, logo, and platform remain our intellectual property.
        </p>
      </DocSection>

      <DocSection number="06" title="Availability">
        <p>
          We are an early-stage product. We do not guarantee 100% uptime. We will communicate planned maintenance in
          advance wherever possible.
        </p>
      </DocSection>

      <DocSection number="07" title="Limitation of Liability">
        <p>
          LinguaMic is provided as-is. We are not liable for any indirect, incidental, or consequential damages arising
          from your use of the platform. Our total liability to you shall not exceed the amount you paid us in the past
          30 days.
        </p>
      </DocSection>

      <DocSection number="08" title="Changes to Terms">
        <p>We may update these terms. We will notify you by email before material changes take effect.</p>
      </DocSection>

      <DocSection number="09" title="Governing Law">
        <p>These terms are governed by the laws of India.</p>
      </DocSection>

      <DocSection number="10" title="Cancellation and Refund Policy">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-neutral-900">Cancellations</h3>
          <p>
            You may cancel your monthly subscription at any time from your account dashboard. Cancellation takes effect
            at the end of your current billing cycle. You retain access to your credits until the cycle ends. We do not
            offer prorated refunds for partial months.
          </p>
        </div>
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-neutral-900">Refunds</h3>
          <p>We offer refunds in the following cases only:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>You were charged incorrectly due to a technical error.</li>
            <li>You cancel within 24 hours of your first subscription payment and have used fewer than 5,000 credits.</li>
          </ul>
          <p>
            To request a refund email company@linguamic.com with your account details and reason. We will respond within 3
            business days.
          </p>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            <p>Pay As You Go credits are non-refundable once purchased.</p>
            <p>Monthly subscription credits reset each billing cycle.</p>
            <p>Unused credits do not carry over and are not refundable.</p>
            <p>Pay As You Go credits never expire and carry over indefinitely.</p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-neutral-900">Exceptional Circumstances</h3>
          <p>
            If LinguaMic experiences extended downtime (more than 48 hours in a billing cycle) due to issues on our side,
            we will issue credit compensation to affected accounts.
          </p>
        </div>
      </DocSection>

      <DocSection number="11" title="Shipping Policy">
        <p>LinguaMic is a fully digital service. We do not sell or ship physical goods.</p>
        <p>
          Upon successful payment your account is instantly activated with the corresponding credits. No shipping, no
          delivery wait time, no physical product. Access is immediate and automatic.
        </p>
        <p>
          Generated audio files are available for download directly within the platform. There is no delivery via email
          or postal service.
        </p>
        <p>
          If you experience any issues accessing your account or credits after payment contact us at{" "}
          <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600">
            company@linguamic.com
          </a>
          .
        </p>
      </DocSection>

      <DocSection number="12" title="Auto-Pay Mandate">
        <p>
          When you purchase a monthly subscription, an automatic payment mandate is activated. Your subscription will
          renew automatically on the same date each month and the corresponding credits will be added to your account.
        </p>
        <p>
          You can cancel or disable the auto-pay mandate at any time from your account dashboard under Settings &gt;
          Subscription &gt; Manage Auto-Pay. Cancellation of the mandate takes effect immediately and your subscription will
          not renew at the next billing cycle. You retain access to your current credits until the end of your paid
          period.
        </p>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-neutral-700">
          We will send an email reminder 3 days before each renewal so you are never surprised by a charge.
        </div>
      </DocSection>

      <DocSection number="13" title="Contact">
        <p>
          Reach us anytime at{" "}
          <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600">
            company@linguamic.com
          </a>
          .
        </p>
      </DocSection>
    </DocsLayout>
  );
}
