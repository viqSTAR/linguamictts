import { Link } from "react-router";
import { ExternalLink, Code } from "lucide-react";

export default function Attributions() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex gap-6">
          <Link to="/" className="text-orange-500 hover:text-orange-600 underline">
            Terms & Conditions
          </Link>
          <Link to="/privacy-policy" className="text-orange-500 hover:text-orange-600 underline">
            Privacy Policy
          </Link>
          <Link to="/about-us" className="text-orange-500 hover:text-orange-600 underline">
            About Us
          </Link>
        </div>

        <div className="border-l-4 border-orange-500 pl-6 mb-12">
          <h1 className="text-black mb-4 text-5xl font-bold">Open Source Licenses</h1>
          <p className="text-gray-600">
            LinguaMic is built with the help of open source technologies. We acknowledge and thank the developers and communities behind these projects.
          </p>
        </div>

        <div className="space-y-8">
          {/* Orpheus TTS */}
          <section className="bg-gray-50 rounded-lg border-2 border-gray-200 p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-orange-500 flex-shrink-0">
                <Code className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-black mb-2">Orpheus TTS</h2>
                <p className="text-gray-600">
                  <strong>Developer:</strong> Canopy Labs
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">License</p>
                <p className="text-black font-medium">Apache License 2.0</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Usage</p>
                <p className="text-gray-700">Powers our text-to-speech voice generation</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-500 mb-2">Repository</p>
                <a
                  href="https://github.com/canopyai/orpheus-tts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:text-orange-600 inline-flex items-center gap-2 font-medium"
                >
                  github.com/canopyai/orpheus-tts
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <p className="text-gray-700 text-sm">
                  <strong>Copyright © Canopy Labs</strong>
                  <br />
                  LinguaMic is not affiliated with or endorsed by Canopy Labs.
                </p>
              </div>
            </div>
          </section>

          {/* Open Source Attribution */}
          <section className="pb-8 border-b border-gray-200">
            <h3 className="text-black mb-4 font-bold text-xl">
              <span className="text-orange-500">•</span> Open Source Attribution
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              LinguaMic is powered by a modified version of Orpheus TTS, originally developed by Canopy Labs, licensed under the Apache License 2.0. Copyright © Canopy Labs.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              We have made optimizations and modifications to the original model to improve performance for our specific use case.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-700">
                The Apache License 2.0 full text is available at{' '}
                <a
                  href="https://apache.org/licenses/LICENSE-2.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:text-orange-600 underline inline-flex items-center gap-1"
                >
                  apache.org/licenses/LICENSE-2.0
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </section>

          {/* Apache License Summary */}
          <section className="bg-white border-2 border-gray-200 rounded-lg p-6">
            <h3 className="text-black mb-4 font-bold">Apache License 2.0 - Summary</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              The Apache License 2.0 is a permissive free software license that allows users to use, modify, and distribute the software for any purpose, subject to the terms and conditions of the license.
            </p>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">✓</span>
                <span>Commercial use permitted</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">✓</span>
                <span>Modification permitted</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">✓</span>
                <span>Distribution permitted</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">✓</span>
                <span>Patent use permitted</span>
              </li>
            </ul>
          </section>

          {/* Contact */}
          <section className="pt-4">
            <p className="text-gray-600 text-sm">
              Questions about our use of open source software?{' '}
              <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600 underline">
                Contact us
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
