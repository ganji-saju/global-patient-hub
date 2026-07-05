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
import { useI18n } from "@/contexts/I18nContext";
import { SAMPLE_HOSPITALS } from "@/lib/sampleData";

const roleCards = [
  {
    icon: HeartPulse,
    titleKey: "network.role.patient.title",
    textKey: "network.role.patient.text",
    href: "/consultation",
    actionKey: "network.role.patient.action",
  },
  {
    icon: Building2,
    titleKey: "network.role.hospital.title",
    textKey: "network.role.hospital.text",
    href: "/network/hospitals",
    actionKey: "network.role.hospital.action",
  },
  {
    icon: Handshake,
    titleKey: "network.role.partner.title",
    textKey: "network.role.partner.text",
    href: "/network/partners",
    actionKey: "network.role.partner.action",
  },
];

const operatingFlow = [
  [
    "01",
    "network.flow.step1.title",
    "network.flow.step1.text",
  ],
  [
    "02",
    "network.flow.step2.title",
    "network.flow.step2.text",
  ],
  [
    "03",
    "network.flow.step3.title",
    "network.flow.step3.text",
  ],
  [
    "04",
    "network.flow.step4.title",
    "network.flow.step4.text",
  ],
  [
    "05",
    "network.flow.step5.title",
    "network.flow.step5.text",
  ],
];

export default function Network() {
  const { t } = useI18n();
  const heroImage = SAMPLE_HOSPITALS[0].coverImage;
  const standards = [
    {
      icon: ShieldCheck,
      title: t("network.standard.verification.title"),
      text: t("network.standard.verification.text"),
    },
    {
      icon: CalendarCheck,
      title: t("network.standard.availability.title"),
      text: t("network.standard.availability.text"),
    },
    {
      icon: Languages,
      title: t("network.standard.routing.title"),
      text: t("network.standard.routing.text"),
    },
  ];

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
              {t("network.hero.kicker")}
            </div>
            <h1 className="text-balance font-serif text-5xl sm:text-6xl">
              {t("network.hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100">
              {t("network.hero.copy")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/consultation">
                <Button
                  size="lg"
                  className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  {t("network.hero.ctaConsult")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/network/hospitals">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  {t("network.hero.ctaHospital")}
                </Button>
              </Link>
              <Link href="/network/partners">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  {t("network.hero.ctaPartner")}
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
              {t("network.roles.heading")}
            </h2>
            <p className="mt-3 text-ink-600">
              {t("network.roles.copy")}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {roleCards.map(card => (
              <div
                key={card.titleKey}
                className="rounded-lg border border-ink-200 bg-white p-5"
              >
                <div className="mb-5 grid size-11 place-items-center rounded-md bg-teal-50 text-teal-700">
                  <card.icon className="size-5" />
                </div>
                <h3 className="font-serif text-3xl text-ink-950">
                  {t(card.titleKey)}
                </h3>
                <p className="mt-3 min-h-24 text-sm leading-6 text-ink-600">
                  {t(card.textKey)}
                </p>
                <Link href={card.href}>
                  <Button
                    variant="outline"
                    className="mt-5 w-full justify-between border-ink-300 text-ink-800"
                  >
                    {t(card.actionKey)}
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
              {t("network.flow.kicker")}
            </div>
            <h2 className="font-serif text-4xl text-ink-950">
              {t("network.flow.title")}
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-600">
              {t("network.flow.copy")}
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
            {operatingFlow.map(([step, titleKey, textKey]) => (
              <div
                key={step}
                className="grid gap-3 border-b border-ink-100 p-5 last:border-b-0 md:grid-cols-[88px_220px_1fr]"
              >
                <div className="font-serif text-2xl text-teal-700">{step}</div>
                <div className="font-semibold text-ink-950">{t(titleKey)}</div>
                <div className="text-sm leading-6 text-ink-600">
                  {t(textKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-4 md:grid-cols-3">
          {standards.map(item => (
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
