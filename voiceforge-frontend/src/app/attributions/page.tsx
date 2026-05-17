import DocsLayout, { DocSection } from "../../components/DocsLayout";
import { ExternalLink, Code } from "lucide-react";

const licenseHighlights = [
  "Commercial use permitted",
  "Modification permitted",
  "Distribution permitted",
  "Patent use permitted",
];

type Attribution = {
  name: string;
  author: string;
  license: string;
  usage: string;
  repo: string;
  repoUrl: string;
};

const ATTRIBUTIONS: Attribution[] = [
  {
    name: "Orpheus TTS",
    author: "Canopy Labs",
    license: "Apache License 2.0",
    usage: "The speech-synthesis model that powers our voice generation",
    repo: "github.com/canopyai/Orpheus-TTS",
    repoUrl: "https://github.com/canopyai/Orpheus-TTS",
  },
  {
    name: "orpheus-tts-local",
    author: "Isaiah Bjork",
    license: "Apache License 2.0",
    usage: "Local-inference client we use to run Orpheus through LM Studio, including the GGUF model quantization",
    repo: "github.com/isaiahbjork/orpheus-tts-local",
    repoUrl: "https://github.com/isaiahbjork/orpheus-tts-local",
  },
  {
    name: "SNAC",
    author: "Hubert Siuzdak",
    license: "MIT License",
    usage: "Neural audio codec that decodes Orpheus's token output into 24 kHz waveforms",
    repo: "github.com/hubertsiuzdak/snac",
    repoUrl: "https://github.com/hubertsiuzdak/snac",
  },
  {
    name: "faster-whisper",
    author: "Guillaume Klein (SYSTRAN)",
    license: "MIT License",
    usage: "High-performance CTranslate2 implementation of OpenAI Whisper, powering our speech-to-text endpoint",
    repo: "github.com/SYSTRAN/faster-whisper",
    repoUrl: "https://github.com/SYSTRAN/faster-whisper",
  },
  {
    name: "Whisper",
    author: "OpenAI",
    license: "MIT License",
    usage: "The underlying speech-recognition model architecture and weights used by faster-whisper",
    repo: "github.com/openai/whisper",
    repoUrl: "https://github.com/openai/whisper",
  },
];

export default function Attributions() {
  return (
    <DocsLayout
      title="Open Source Licenses"
      subtitle="LinguaMic is built on the work of the open source community. We acknowledge and thank the developers and communities behind these projects."
    >
      <DocSection number="01" title="What We Use">
        <p>
          LinguaMic&apos;s voice pipeline is an integration of several open-source projects. We have not modified the
          underlying model weights of any of these projects. Our customizations sit in the prompt-formatting, chunking,
          tone-preset, and serving layers we wrote on top.
        </p>

        <div className="space-y-4">
          {ATTRIBUTIONS.map((a) => (
            <div key={a.name} className="rounded-2xl border border-neutral-200 bg-white p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                  <Code className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-neutral-900">{a.name}</p>
                  <p className="text-sm text-neutral-500">Developer: {a.author}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">License</p>
                  <p className="mt-2 text-sm font-semibold text-neutral-900">{a.license}</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Usage</p>
                  <p className="mt-2 text-sm text-neutral-600">{a.usage}</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Repository</p>
                  <a
                    href={a.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-600"
                  >
                    {a.repo}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          LinguaMic is not affiliated with or endorsed by Canopy Labs, Isaiah Bjork, OpenAI, SYSTRAN, or the SNAC author.
          All trademarks are the property of their respective owners.
        </div>
      </DocSection>

      <DocSection number="02" title="Our Customizations">
        <p>
          We have <strong>not</strong> retrained or fine-tuned the Orpheus speech model. The underlying weights are the
          unmodified <em>canopylabs/orpheus-3b-0.1-ft</em> checkpoint distributed by Canopy Labs.
        </p>
        <p>What we do build on top:</p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
          <li>A FastAPI service that wraps the inference pipeline and exposes our internal API.</li>
          <li>A corrected prompt-formatting layer that adds Canopy&apos;s audio-primer tokens that the upstream GGUF
            client omits.</li>
          <li>A library of tone presets (calm, romantic, storytelling, horror, angry, adventurous, excited, sad, funny)
            that drive Orpheus&apos;s sampling parameters.</li>
          <li>Text sanitization that strips emotion tags not in the Orpheus vocabulary and splits CamelCase brand names
            so the model pronounces them correctly.</li>
          <li>A chunking layer that splits long input at sentence and clause boundaries while keeping emotion tags
            inline.</li>
        </ul>
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
            . The MIT License full text is available at{" "}
            <a
              href="https://opensource.org/licenses/MIT"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-orange-500 hover:text-orange-600"
            >
              opensource.org/licenses/MIT
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
