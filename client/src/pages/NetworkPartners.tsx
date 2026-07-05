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
import { useI18n } from "@/contexts/I18nContext";
import { SAMPLE_HOSPITALS } from "@/lib/sampleData";

const partnerTypes = [
  {
    icon: BriefcaseBusiness,
    titleKey: "networkPartners.role.medical.title",
    textKey: "networkPartners.role.medical.text",
  },
  {
    icon: Languages,
    titleKey: "networkPartners.role.interpreter.title",
    textKey: "networkPartners.role.interpreter.text",
  },
  {
    icon: Plane,
    titleKey: "networkPartners.role.travel.title",
    textKey: "networkPartners.role.travel.text",
  },
  {
    icon: UsersRound,
    titleKey: "networkPartners.role.concierge.title",
    textKey: "networkPartners.role.concierge.text",
  },
];

const boundaries = [
  "networkPartners.boundary.item1",
  "networkPartners.boundary.item2",
  "networkPartners.boundary.item3",
  "networkPartners.boundary.item4",
];

export default function NetworkPartners() {
  const { t } = useI18n();
  const heroImage = SAMPLE_HOSPITALS[5].coverImage;
  const standards = [
    {
      icon: ShieldCheck,
      title: t("networkPartners.standard.consent.title"),
      text: t("networkPartners.standard.consent.text"),
    },
    {
      icon: CalendarCheck,
      title: t("networkPartners.standard.timing.title"),
      text: t("networkPartners.standard.timing.text"),
    },
    {
      icon: Handshake,
      title: t("networkPartners.standard.providers.title"),
      text: t("networkPartners.standard.providers.text"),
    },
  ];

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
              {t("networkPartners.hero.kicker")}
            </div>
            <h1 className="text-balance font-serif text-5xl sm:text-6xl">
              {t("networkPartners.hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100">
              {t("networkPartners.hero.copy")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/admin/partners">
                <Button
                  size="lg"
                  className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  {t("networkPartners.hero.ctaRegistry")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/partner/cases">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  {t("networkPartners.hero.ctaBoard")}
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
              {t("networkPartners.roles.heading")}
            </h2>
            <p className="mt-3 text-ink-600">
              {t("networkPartners.roles.copy")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {partnerTypes.map(item => (
              <div
                key={item.titleKey}
                className="rounded-lg border border-ink-200 bg-white p-5"
              >
                <div className="mb-5 grid size-11 place-items-center rounded-md bg-teal-50 text-teal-700">
                  <item.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-ink-950">
                  {t(item.titleKey)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-ink-600">
                  {t(item.textKey)}
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
              {t("networkPartners.boundary.kicker")}
            </div>
            <h2 className="font-serif text-4xl text-ink-950">
              {t("networkPartners.boundary.title")}
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-600">
              {t("networkPartners.boundary.copy")}
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
                <p className="text-sm leading-6 text-ink-700">{t(item)}</p>
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
              <h3 className="font-semibold text-ink-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}
