import DocsLayout, { DocSection } from "../../components/DocsLayout";
import { ExternalLink, Code } from "lucide-react";

const licenseHighlights = [
  "Commercial use permitted",
  "Modification permitted",
  "Distribution permitted",
  "Patent use permitted",
];

export default function Attributions() {
  return (
    <DocsLayout
      title="Open Source Licenses"
      subtitle="LinguaMic is built with the help of open source technologies. We acknowledge and thank the developers and communities behind these projects."
    >
      <DocSection number="01" title="Orpheus TTS">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Code className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold text-neutral-900">Orpheus TTS</p>
              <p className="text-sm text-neutral-500">Developer: Canopy Labs</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">License</p>
              <p className="mt-2 text-sm font-semibold text-neutral-900">Apache License 2.0</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Usage</p>
              <p className="mt-2 text-sm text-neutral-600">Powers our text-to-speech voice generation</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Repository</p>
              <a
                href="https://github.com/canopyai/orpheus-tts"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600"
              >
                github.com/canopyai/orpheus-tts
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            <strong>Copyright (c) Canopy Labs.</strong> LinguaMic is not affiliated with or endorsed by Canopy Labs.
          </div>
        </div>
      </DocSection>

      <DocSection number="02" title="Open Source Attribution">
        <p>
          LinguaMic is powered by a modified version of Orpheus TTS, originally developed by Canopy Labs, licensed under
          the Apache License 2.0. Copyright (c) Canopy Labs.
        </p>
        <p>We have made optimizations and modifications to the original model to improve performance for our specific use case.</p>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-700">
            The Apache License 2.0 full text is available at{" "}
            <a
              href="https://apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-500 hover:text-orange-600"
            >
              apache.org/licenses/LICENSE-2.0
            </a>
            .
          </p>
        </div>
      </DocSection>

      <DocSection number="03" title="Apache License 2.0 - Summary">
        <p className="text-sm text-neutral-600">
          The Apache License 2.0 is a permissive free software license that allows users to use, modify, and distribute
          the software for any purpose, subject to the terms and conditions of the license.
        </p>
        <ul className="grid gap-3 text-sm text-neutral-700 md:grid-cols-2">
          {licenseHighlights.map((item) => (
            <li key={item} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">
                OK
              </span>
              <span className="font-medium">{item}</span>
            </li>
          ))}
        </ul>
      </DocSection>

      <DocSection number="04" title="Contact">
        <p className="text-sm text-neutral-500">
          Questions about our use of open source software?{" "}
          <a href="mailto:company@linguamic.com" className="text-orange-500 hover:text-orange-600">
            Contact us
          </a>
          .
        </p>
      </DocSection>
    </DocsLayout>
  );
}
