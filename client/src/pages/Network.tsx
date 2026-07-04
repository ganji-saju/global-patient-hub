import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  Handshake,
  HeartPulse,
  Languages,
  ShieldCheck,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { SAMPLE_HOSPITALS } from "@/lib/sampleData";

const roleCards = [
  {
    icon: HeartPulse,
    title: "Patients",
    text: "Submit one structured request with care goals, language, budget, travel dates, and consent. GCL routes the case to suitable providers and support partners.",
    href: "/consultation",
    action: "Start consultation",
  },
  {
    icon: Building2,
    title: "Hospitals",
    text: "Publish a verified profile, maintain doctors and treatment pricing, receive quote requests, and coordinate slots from one provider workflow.",
    href: "/network/hospitals",
    action: "Hospital network",
  },
  {
    icon: Handshake,
    title: "Partners",
    text: "Support cases as agencies, interpreters, travel teams, and concierges with scoped access to assigned patient journeys.",
    href: "/network/partners",
    action: "Partner network",
  },
];

const operatingFlow = [
  [
    "01",
    "Patient intake",
    "Goals, travel window, budget, language, and consent are captured in a single request.",
  ],
  [
    "02",
    "GCL triage",
    "Eligibility, provider fit, partner support needs, and risk flags are reviewed by operations.",
  ],
  [
    "03",
    "Provider quote",
    "Hospitals return separated medical fees, deposit terms, availability, and recovery notes.",
  ],
  [
    "04",
    "Partner support",
    "Assigned partners handle non-medical services only when the patient has consented.",
  ],
  [
    "05",
    "Booking path",
    "Temporary slot holds, deposit links, alerts, and confirmations keep the case moving.",
  ],
];

export default function Network() {
  const heroImage = SAMPLE_HOSPITALS[0].coverImage;

  return (
    <Layout>
      <section
        className="relative border-b border-ink-200 bg-ink-950"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(8, 15, 26, 0.92), rgba(8, 15, 26, 0.72), rgba(8, 15, 26, 0.18)), url(${heroImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="container-wide flex min-h-[520px] items-end pb-14 pt-24 text-white">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-100">
              <Languages className="size-4" />
              GCL Network
            </div>
            <h1 className="text-balance font-serif text-5xl sm:text-6xl">
              One operating layer for patients, hospitals, and care partners.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100">
              Global Connected Lab coordinates Korean medical tourism as a
              three-sided network: patient demand, verified clinical supply, and
              trusted non-medical support.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/consultation">
                <Button
                  size="lg"
                  className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  Start consultation
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/network/hospitals">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  Join as hospital
                </Button>
              </Link>
              <Link href="/network/partners">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  Join as partner
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="mb-10 max-w-3xl">
            <h2 className="font-serif text-4xl text-ink-950">
              Three entrances, one case record
            </h2>
            <p className="mt-3 text-ink-600">
              GCL keeps each actor focused on the information and actions they
              need, while operations maintains the whole patient journey from
              consultation to booking.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {roleCards.map(card => (
              <div
                key={card.title}
                className="rounded-lg border border-ink-200 bg-white p-5"
              >
                <div className="mb-5 grid size-11 place-items-center rounded-md bg-teal-50 text-teal-700">
                  <card.icon className="size-5" />
                </div>
                <h3 className="font-serif text-3xl text-ink-950">
                  {card.title}
                </h3>
                <p className="mt-3 min-h-24 text-sm leading-6 text-ink-600">
                  {card.text}
                </p>
                <Link href={card.href}>
                  <Button
                    variant="outline"
                    className="mt-5 w-full justify-between border-ink-300 text-ink-800"
                  >
                    {card.action}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding border-y border-ink-200 bg-ink-50">
        <div className="container-wide grid gap-8 lg:grid-cols-[380px_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal-700">
              <ClipboardList className="size-4" />
              Network operating flow
            </div>
            <h2 className="font-serif text-4xl text-ink-950">
              A request should never become a spreadsheet maze.
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-600">
              The network pages make the public promise clear. The admin console
              keeps the operational promise measurable: cases, provider quotes,
              partner requests, holds, alerts, and payments.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
            {operatingFlow.map(([step, title, text]) => (
              <div
                key={step}
                className="grid gap-3 border-b border-ink-100 p-5 last:border-b-0 md:grid-cols-[88px_220px_1fr]"
              >
                <div className="font-serif text-2xl text-teal-700">{step}</div>
                <div className="font-semibold text-ink-950">{title}</div>
                <div className="text-sm leading-6 text-ink-600">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Verification",
              text: "Hospitals and partners are tracked by registration, data quality, SLA, and operating readiness.",
            },
            {
              icon: CalendarCheck,
              title: "Availability",
              text: "Quotes and reservations connect to temporary holds and confirmation workflows.",
            },
            {
              icon: Languages,
              title: "Global routing",
              text: "Language, market, and support preferences determine what each actor sees next.",
            },
          ].map(item => (
            <div
              key={item.title}
              className="rounded-lg border border-ink-200 bg-ink-50 p-5"
            >
              <item.icon className="mb-4 size-6 text-teal-700" />
              <h3 className="text-lg font-semibold text-ink-950">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
