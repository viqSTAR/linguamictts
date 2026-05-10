import DocsLayout, { DocSection } from "../../components/DocsLayout";

const highlights = [
  {
    title: "Global Vision",
    description: "Building from India with a mission to connect voices across the world.",
  },
  {
    title: "For Everyone",
    description: "Creators, professionals, and anyone who works across languages.",
  },
];

export default function AboutUs() {
  return (
    <DocsLayout title="About Us" subtitle="Your voice, any language, any emotion.">
      <DocSection number="01" title="What We Do">
        <p>
          LinguaMic is an AI-powered voice platform built for creators, professionals, and anyone who works across
          languages. We provide text-to-speech, speech-to-text, and real-time voice translation tools designed to make
          communication effortless and natural.
        </p>
        <p>
          We are an early-stage startup founded by <strong>Abhishek</strong> and <strong>Vikashdeep</strong>, building from
          India with a global vision.
        </p>
      </DocSection>

      <DocSection number="02" title="Why It Matters">
        <div className="grid gap-4 md:grid-cols-2">
          {highlights.map((item) => (
            <div key={item.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <p className="text-base font-semibold text-neutral-900">{item.title}</p>
              <p className="mt-2 text-sm text-neutral-600">{item.description}</p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection number="03" title="Our Mission">
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-6 py-6 text-lg text-neutral-800">
          Your voice, any language, any emotion.
        </div>
      </DocSection>

      <DocSection number="04" title="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Email</p>
            <a href="mailto:company@linguamic.com" className="mt-2 block font-medium text-orange-500 hover:text-orange-600">
              company@linguamic.com
            </a>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Location</p>
            <p className="mt-2 font-medium text-neutral-800">Patna, Bihar, India</p>
          </div>
        </div>
      </DocSection>
    </DocsLayout>
  );
}
