import { Link } from "react-router";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex gap-6 flex-wrap">
          <Link to="/privacy-policy" className="text-orange-500 hover:text-orange-600 underline">
            Privacy Policy
          </Link>
          <Link to="/about-us" className="text-orange-500 hover:text-orange-600 underline">
            About Us
          </Link>
          <Link to="/attributions" className="text-orange-500 hover:text-orange-600 underline">
            Attributions
          </Link>
        </div>

        <div className="border-l-4 border-orange-500 pl-6 mb-12">
          <h1 className="text-black mb-4 text-5xl font-bold">Terms & Conditions</h1>
          <p className="text-gray-600 mb-2">Effective: May 9, 2026</p>
          <p className="text-gray-600">
            By accessing or using LinguaMic you agree to these terms. If you do not agree, do not use the service.
          </p>
        </div>

        <div className="space-y-12">
          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">1.</span> The Service</h3>
            <p className="text-gray-600 leading-relaxed">
              LinguaMic provides AI voice generation (TTS), speech transcription (STT), and voice translation tools through a web-based platform. Access is granted upon payment of applicable subscription or credit fees.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">2.</span> Eligibility</h3>
            <p className="text-gray-600 leading-relaxed">
              You must be at least 13 years old to use LinguaMic. By using the service you confirm you meet this requirement.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">3.</span> Credits and Subscriptions</h3>
            <p className="text-gray-600 leading-relaxed mb-6">
              LinguaMic operates on a credit-based system. Credits are consumed when you use TTS or STT features. We offer the following plans:
            </p>

            <div className="mb-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
              <p className="text-black mb-3 font-bold">Monthly Subscriptions:</p>
              <ul className="space-y-2 text-gray-600 ml-5">
                <li><span className="text-orange-500">•</span> Starter - 45,000 credits for $4.99/month</li>
                <li><span className="text-orange-500">•</span> Creator - 210,000 credits for $18.99/month</li>
                <li><span className="text-orange-500">•</span> Pro - 859,000 credits for $79.99/month</li>
              </ul>
            </div>

            <div className="mb-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
              <p className="text-black mb-3 font-bold">Pay As You Go:</p>
              <p className="text-gray-600">5,000 credits per $1.00</p>
            </div>

            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded mb-4">
              <p className="text-gray-700 leading-relaxed">
                However users will receive a total of 10k free credits per month.
              </p>
            </div>

            <p className="text-gray-600 leading-relaxed mb-4">
              Monthly subscription credits reset at the start of each billing cycle. Unused credits do not carry over. Pay As You Go credits do not expire.
            </p>

            <div className="bg-gray-100 border border-gray-300 p-4 rounded">
              <p className="text-gray-700 leading-relaxed italic">
                <span className="text-orange-500 mr-2">ⓘ</span>Users under 18 are required to take parental consent before making any purchases on LinguaMic.
              </p>
            </div>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">4.</span> Acceptable Use</h3>
            <p className="text-gray-600 leading-relaxed">
              You agree not to use LinguaMic to generate content that is illegal, harmful, defamatory, or violates the rights of others. You agree not to use the platform to impersonate real people without consent, generate voice clones of individuals without their permission, or attempt to reverse engineer the underlying technology.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">5.</span> Intellectual Property</h3>
            <p className="text-gray-600 leading-relaxed">
              Audio generated using LinguaMic may be used for personal and commercial purposes. LinguaMic retains no ownership of your generated content. The LinguaMic name, logo, and platform remain our intellectual property.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">6.</span> Availability</h3>
            <p className="text-gray-600 leading-relaxed">
              We are an early-stage product. We do not guarantee 100% uptime. We will communicate planned maintenance in advance wherever possible.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">7.</span> Limitation of Liability</h3>
            <p className="text-gray-600 leading-relaxed">
              LinguaMic is provided as-is. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability to you shall not exceed the amount you paid us in the past 30 days.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">8.</span> Changes to Terms</h3>
            <p className="text-gray-600 leading-relaxed">
              We may update these terms. We will notify you by email before material changes take effect.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">9.</span> Governing Law</h3>
            <p className="text-gray-600 leading-relaxed">
              These terms are governed by the laws of India.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">10.</span> Cancellation & Refund Policy</h3>

            <div className="mb-6">
              <h4 className="text-black mb-3 font-bold">Cancellations</h4>
              <p className="text-gray-600 leading-relaxed">
                You may cancel your monthly subscription at any time from your account dashboard. Cancellation takes effect at the end of your current billing cycle. You retain access to your credits until the cycle ends. We do not offer prorated refunds for partial months.
              </p>
            </div>

            <div className="mb-6">
              <h4 className="text-black mb-3 font-bold">Refunds</h4>
              <p className="text-gray-600 leading-relaxed mb-4">
                We offer refunds in the following cases only:
              </p>
              <ul className="space-y-2 text-gray-600 ml-5 mb-4">
                <li><span className="text-orange-500">1.</span> You were charged incorrectly due to a technical error</li>
                <li><span className="text-orange-500">2.</span> You cancel within 24 hours of your first subscription payment and have used fewer than 5,000 credits</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mb-4">
                To request a refund email company@linguamic.com with your account details and reason. We will respond within 3 business days.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
                <p className="text-gray-600"><span className="text-orange-500">•</span> Pay As You Go credits are non-refundable once purchased.</p>
                <p className="text-gray-600"><span className="text-orange-500">•</span> Monthly subscription credits reset each billing cycle.</p>
                <p className="text-gray-600"><span className="text-orange-500">•</span> Unused credits do not carry over and are not refundable.</p>
                <p className="text-gray-600"><span className="text-orange-500">•</span> Pay As You Go credits never expire and carry over indefinitely.</p>
              </div>
            </div>

            <div>
              <h4 className="text-black mb-3 font-bold">Exceptional Circumstances</h4>
              <p className="text-gray-600 leading-relaxed">
                If LinguaMic experiences extended downtime (more than 48 hours in a billing cycle) due to issues on our side, we will issue credit compensation to affected accounts.
              </p>
            </div>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">11.</span> Shipping Policy</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              LinguaMic is a fully digital service. We do not sell or ship physical goods.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Upon successful payment your account is instantly activated with the corresponding credits. No shipping, no delivery wait time, no physical product. Access is immediate and automatic.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Generated audio files are available for download directly within the platform. There is no delivery via email or postal service.
            </p>
            <p className="text-gray-600 leading-relaxed">
              If you experience any issues accessing your account or credits after payment contact us at <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600 underline">company@linguamic.com</a> and we will resolve it within 24 hours.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">12.</span> Auto-Pay Mandate</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              When you purchase a monthly subscription, an automatic payment mandate is activated. Your subscription will renew automatically on the same date each month and the corresponding credits will be added to your account.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              You can cancel or disable the auto-pay mandate at any time from your account dashboard under <strong>Settings → Subscription → Manage Auto-Pay</strong>. Cancellation of the mandate takes effect immediately and your subscription will not renew at the next billing cycle. You retain access to your current credits until the end of your paid period.
            </p>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
              <p className="text-gray-700 leading-relaxed">
                We will send an email reminder 3 days before each renewal so you are never surprised by a charge.
              </p>
            </div>
          </section>

          <section className="pt-8">
            <p className="text-gray-600">
              Contact: <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600 underline">company@linguamic.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
