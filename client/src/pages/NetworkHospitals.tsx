import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  Hospital,
  Languages,
  ListChecks,
  WalletCards,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { SAMPLE_HOSPITALS } from "@/lib/sampleData";

const profileItems = [
  "Public profile CMS for multilingual summaries, highlights, media, doctors, and treatments.",
  "Structured treatment pricing that can later be exposed on hospital detail pages.",
  "Operating profile fields for supported markets, languages, SLA, readiness, and next steps.",
  "Quote desk access for assigned requests and provider responses.",
];

const onboardingSteps = [
  [
    "01",
    "Register legal and operating data",
    "Facility type, address, public status, commission cap, and quality score.",
  ],
  [
    "02",
    "Build public profile",
    "Locale tabs, doctors, media, and treatment price rows make the provider searchable.",
  ],
  [
    "03",
    "Confirm quote workflow",
    "SLA, deposit policy, quote template, and supported languages are checked before case routing.",
  ],
  [
    "04",
    "Receive matched requests",
    "Provider quote requests arrive with patient alias, travel window, procedure, budget, and due date.",
  ],
];

export default function NetworkHospitals() {
  const heroImage = SAMPLE_HOSPITALS[1].coverImage;

  return (
    <Layout>
      <section
        className="relative border-b border-ink-200 bg-ink-950"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(8, 15, 26, 0.9), rgba(8, 15, 26, 0.68), rgba(8, 15, 26, 0.16)), url(${heroImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="container-wide flex min-h-[500px] items-end pb-14 pt-24 text-white">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-100">
              <Hospital className="size-4" />
              Hospital network
            </div>
            <h1 className="text-balance font-serif text-5xl sm:text-6xl">
              Turn hospital readiness into visible, quote-ready supply.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100">
              GCL lets hospitals manage public profile content, treatment
              prices, quote requests, and booking readiness from the same
              operating layer.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/admin/providers">
                <Button
                  size="lg"
                  className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  Open provider registry
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/hospitals">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  View hospitals
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="font-serif text-4xl text-ink-950">
              What a hospital can manage
            </h2>
            <p className="mt-3 text-ink-600">
              The current admin registry is the foundation for a later hospital
              self-service profile editor.
            </p>
          </div>
          <div className="grid gap-3">
            {profileItems.map((item, index) => (
              <div
                key={item}
                className="flex gap-3 rounded-lg border border-ink-200 bg-ink-50 p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-xs font-bold text-teal-700">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-ink-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding border-y border-ink-200 bg-ink-50">
        <div className="container-wide">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-serif text-4xl text-ink-950">
              Hospital onboarding path
            </h2>
            <p className="mt-3 text-ink-600">
              Each step maps directly to a field group already present in the
              operations console.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {onboardingSteps.map(([step, title, text]) => (
              <div
                key={step}
                className="rounded-lg border border-ink-200 bg-white p-5"
              >
                <div className="mb-6 font-serif text-3xl text-teal-700">
                  {step}
                </div>
                <h3 className="text-lg font-semibold text-ink-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-4 md:grid-cols-4">
          {[
            {
              icon: BadgeCheck,
              title: "Verification",
              text: "Registration, insurance, and public exposure status.",
            },
            {
              icon: Languages,
              title: "Languages",
              text: "Supported patient markets and coordinator languages.",
            },
            {
              icon: WalletCards,
              title: "Pricing",
              text: "Treatment rows and quote templates for comparable offers.",
            },
            {
              icon: CalendarDays,
              title: "Booking",
              text: "Availability slots, temporary holds, and confirmations.",
            },
          ].map(item => (
            <div
              key={item.title}
              className="rounded-lg border border-ink-200 bg-ink-50 p-5"
            >
              <item.icon className="mb-4 size-6 text-teal-700" />
              <h3 className="font-semibold text-ink-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink-950 py-10 text-white">
        <div className="container-wide flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-200">
              <ClipboardCheck className="size-4" />
              Ready for provider operations
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">
              Admins can register hospitals today. A direct hospital profile
              editor is scheduled in the next priority phase.
            </p>
          </div>
          <Link href="/admin/providers">
            <Button className="bg-white text-ink-950 hover:bg-ink-100">
              Manage hospitals
              <ListChecks className="size-4" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
