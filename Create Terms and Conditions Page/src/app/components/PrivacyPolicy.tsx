import { Link } from "react-router";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex gap-6 flex-wrap">
          <Link to="/" className="text-orange-500 hover:text-orange-600 underline">
            Terms & Conditions
          </Link>
          <Link to="/about-us" className="text-orange-500 hover:text-orange-600 underline">
            About Us
          </Link>
          <Link to="/attributions" className="text-orange-500 hover:text-orange-600 underline">
            Attributions
          </Link>
        </div>

        <div className="border-l-4 border-orange-500 pl-6 mb-12">
          <h1 className="text-black mb-4 text-5xl font-bold">Privacy Policy</h1>
          <p className="text-gray-600 mb-2">Effective: May 9, 2026</p>
          <p className="text-gray-600">
            We are an early-stage startup. This policy is written plainly and honestly. We don't sell your data, we don't use dark patterns, and we won't pretend to have infrastructure we don't have yet.
          </p>
        </div>

        <div className="space-y-12">
          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">1.</span> Who We Are</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              LinguaMic is an AI-powered voice platform providing text-to-speech, speech-to-text, and voice translation services. We are founded by Abhishek and Vikashdeep, based in India, building for a global audience.
            </p>
            <p className="text-gray-600">
              Contact: <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600 underline">company@linguamic.com</a>
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">2.</span> What We Collect</h3>
            <ul className="space-y-3 text-gray-600">
              <li className="leading-relaxed"><span className="text-orange-500">•</span> <strong>Account information</strong> - name, email address, password when you register.</li>
              <li className="leading-relaxed"><span className="text-orange-500">•</span> <strong>Payment information</strong> - we do not store your card details.</li>
              <li className="leading-relaxed"><span className="text-orange-500">•</span> <strong>Usage data</strong> - credits consumed, features used, session duration. This helps us improve the product.</li>
              <li className="leading-relaxed"><span className="text-orange-500">•</span> <strong>Text inputs</strong> - text you submit for TTS generation. We do not permanently store your text inputs after audio is generated unless you explicitly save them.</li>
              <li className="leading-relaxed"><span className="text-orange-500">•</span> <strong>Audio outputs</strong> - generated audio files are stored temporarily for download. We do not use your generated audio to train models.</li>
              <li className="leading-relaxed"><span className="text-orange-500">•</span> <strong>Device and technical data</strong> - browser type, IP address, device information for security and performance purposes.</li>
              <li className="leading-relaxed"><span className="text-orange-500">•</span> <strong>Communications</strong> - if you contact us by email we retain that communication to respond to you.</li>
            </ul>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">3.</span> What We Do Not Collect</h3>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded space-y-2">
              <p className="text-gray-700 leading-relaxed">We do not collect your voice recordings unless you use the STT feature, in which case audio is processed in real time and not stored permanently.</p>
              <p className="text-gray-700 leading-relaxed">We do not sell your data. Ever.</p>
              <p className="text-gray-700 leading-relaxed">We do not share your data with advertisers.</p>
            </div>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">4.</span> How We Use Your Data</h3>
            <ul className="space-y-2 text-gray-600">
              <li><span className="text-orange-500">•</span> To provide and improve LinguaMic's services</li>
              <li><span className="text-orange-500">•</span> To manage your account and credits</li>
              <li><span className="text-orange-500">•</span> To process payments and manage subscriptions</li>
              <li><span className="text-orange-500">•</span> To send transactional emails - account confirmation, renewal reminders, credit updates</li>
              <li><span className="text-orange-500">•</span> To send product updates occasionally - you can unsubscribe anytime</li>
              <li><span className="text-orange-500">•</span> To detect fraud and ensure platform security</li>
            </ul>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">5.</span> Auto-Pay and Payment Data</h3>
            <p className="text-gray-600 leading-relaxed">
              When you enable an auto-pay mandate for monthly subscriptions, your payment details are stored securely by our payment processors. LinguaMic does not store your card or bank details directly. You can cancel your auto-pay mandate anytime from your account settings.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">6.</span> Free Credits</h3>
            <p className="text-gray-600 leading-relaxed">
              All users receive 10,000 free credits monthly. No payment information is required to access your free credits. We collect only your email address and account information for free tier users.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">7.</span> Open Source and Third Party Services</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              LinguaMic uses the following third party services:
            </p>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-2">
              <p className="text-gray-600"><span className="text-orange-500">•</span> <strong>Orpheus TTS (Canopy Labs)</strong> - powers voice generation, Apache 2.0 license</p>
              <p className="text-gray-600"><span className="text-orange-500">•</span> <strong>Whisper (OpenAI)</strong> - powers speech transcription</p>
              <p className="text-gray-600"><span className="text-orange-500">•</span> <strong>MongoDB</strong> - database hosting</p>
              <p className="text-gray-600"><span className="text-orange-500">•</span> <strong>Cloudflare</strong> - content delivery and security</p>
            </div>
            <p className="text-gray-600 leading-relaxed mt-4">
              Each third party operates under their own privacy policy.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">8.</span> Data Retention</h3>
            <p className="text-gray-600 leading-relaxed">
              We retain your account data for as long as your account is active. If you delete your account we will delete your personal data within 30 days. Generated audio files are stored temporarily and deleted within 7 days unless you save them to your account.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">9.</span> Your Rights</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Regardless of where you are located you have the right to:
            </p>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li><span className="text-orange-500">•</span> Access the data we hold about you</li>
              <li><span className="text-orange-500">•</span> Request deletion of your account and data</li>
              <li><span className="text-orange-500">•</span> Correct inaccurate information</li>
              <li><span className="text-orange-500">•</span> Export your data</li>
              <li><span className="text-orange-500">•</span> Unsubscribe from marketing emails at any time</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">
              To exercise any of these rights email <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600 underline">company@linguamic.com</a>. We respond within 3 days.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">10.</span> Children's Privacy</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              LinguaMic is available to users aged 13 and above. Users under 18 require parental consent to make purchases. We do not knowingly collect personal data from children under 13.
            </p>
            <div className="bg-gray-100 border border-gray-300 p-4 rounded">
              <p className="text-gray-700 leading-relaxed">
                <span className="text-orange-500 mr-2">ⓘ</span>If you believe a child under 13 has created an account please contact us immediately at <a href="mailto:privacy@linguamic.com" className="text-orange-500 hover:text-orange-600 underline">privacy@linguamic.com</a>
              </p>
            </div>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">11.</span> Security</h3>
            <p className="text-gray-600 leading-relaxed">
              We are a small early-stage team. We take reasonable precautions — encrypted connections, secure database hosting, limited internal access to user data. We do not claim enterprise-grade security infrastructure. If we become aware of a breach affecting your data we will notify you within 72 hours.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">12.</span> International Users</h3>
            <p className="text-gray-600 leading-relaxed">
              LinguaMic serves users globally. By using LinguaMic you consent to your data being processed in India where our servers and team are based. We handle international data in compliance with applicable regulations.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">13.</span> Changes to This Policy</h3>
            <p className="text-gray-600 leading-relaxed">
              We will notify you by email before any material changes take effect. We will not retroactively change how we use data you have already provided.
            </p>
          </section>

          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold"><span className="text-orange-500">14.</span> Contact</h3>
            <p className="text-gray-600 leading-relaxed mb-2">
              <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600 underline">company@linguamic.com</a>
            </p>
            <p className="text-gray-600 leading-relaxed italic">
              We are real people and we will respond personally.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
