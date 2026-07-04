import { Link } from "wouter";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck,
  Handshake,
  KeyRound,
  Languages,
  Plane,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { SAMPLE_HOSPITALS } from "@/lib/sampleData";

const partnerTypes = [
  {
    icon: BriefcaseBusiness,
    title: "Medical agencies",
    text: "Manage sourced patients and coordinate provider shortlist requests.",
  },
  {
    icon: Languages,
    title: "Interpreters",
    text: "Support language handoff and visit communication for assigned cases.",
  },
  {
    icon: Plane,
    title: "Travel teams",
    text: "Handle airport pickup, hotel recovery, transport, and itinerary services.",
  },
  {
    icon: UsersRound,
    title: "Concierge operators",
    text: "Coordinate non-medical care steps without accessing unrelated hospital operations.",
  },
];

const boundaries = [
  "Partners only see cases assigned to their account or scope.",
  "Patient sharing consent is captured before non-medical support is assigned.",
  "Provider choice, quote request, and booking actions remain traceable in the case activity log.",
  "Settlement and service management are planned for the partner self-service phase.",
];

export default function NetworkPartners() {
  const heroImage = SAMPLE_HOSPITALS[5].coverImage;

  return (
    <Layout>
      <section
        className="relative border-b border-ink-200 bg-ink-950"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(8, 15, 26, 0.9), rgba(8, 15, 26, 0.7), rgba(8, 15, 26, 0.16)), url(${heroImage})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="container-wide flex min-h-[500px] items-end pb-14 pt-24 text-white">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-100">
              <Handshake className="size-4" />
              Partner network
            </div>
            <h1 className="text-balance font-serif text-5xl sm:text-6xl">
              Let partners support the journey without blurring medical
              accountability.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100">
              GCL gives agencies, interpreters, travel teams, and concierges a
              scoped way to support patient cases while hospitals own clinical
              decisions and quotes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/admin/partners">
                <Button
                  size="lg"
                  className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  Open partner registry
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/partner/cases">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  Partner case board
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide">
          <div className="mb-8 max-w-3xl">
            <h2 className="font-serif text-4xl text-ink-950">
              Partner roles in the GCL network
            </h2>
            <p className="mt-3 text-ink-600">
              Partner work is intentionally separated from clinical quoting.
              This keeps patient support useful, auditable, and easier to scale.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {partnerTypes.map(item => (
              <div
                key={item.title}
                className="rounded-lg border border-ink-200 bg-white p-5"
              >
                <div className="mb-5 grid size-11 place-items-center rounded-md bg-teal-50 text-teal-700">
                  <item.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-ink-600">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding border-y border-ink-200 bg-ink-50">
        <div className="container-wide grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal-700">
              <KeyRound className="size-4" />
              Scoped access model
            </div>
            <h2 className="font-serif text-4xl text-ink-950">
              Clear boundaries make partner access safer.
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-600">
              Admins can register partner accounts, assign cases, and keep
              hospital quote workflows separate from non-medical support work.
            </p>
          </div>
          <div className="grid gap-3">
            {boundaries.map((item, index) => (
              <div
                key={item}
                className="flex gap-3 rounded-lg border border-ink-200 bg-white p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-teal-50 text-xs font-bold text-teal-700">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-ink-700">{item}</p>
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
              title: "Consent first",
              text: "Patient consent controls when partner support can be attached to a case.",
            },
            {
              icon: CalendarCheck,
              title: "Case timing",
              text: "Partners can help keep travel and recovery logistics aligned with booking status.",
            },
            {
              icon: Handshake,
              title: "Preferred providers",
              text: "Admins can store partner provider preferences for faster shortlist work.",
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
    </Layout>
  );
}
