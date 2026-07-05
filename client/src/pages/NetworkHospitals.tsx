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
import { useI18n } from "@/contexts/I18nContext";
import { SAMPLE_HOSPITALS } from "@/lib/sampleData";

const profileItems = [
  "networkHospitals.manage.item1",
  "networkHospitals.manage.item2",
  "networkHospitals.manage.item3",
  "networkHospitals.manage.item4",
];

const onboardingSteps = [
  [
    "01",
    "networkHospitals.onboarding.step1.title",
    "networkHospitals.onboarding.step1.text",
  ],
  [
    "02",
    "networkHospitals.onboarding.step2.title",
    "networkHospitals.onboarding.step2.text",
  ],
  [
    "03",
    "networkHospitals.onboarding.step3.title",
    "networkHospitals.onboarding.step3.text",
  ],
  [
    "04",
    "networkHospitals.onboarding.step4.title",
    "networkHospitals.onboarding.step4.text",
  ],
];

export default function NetworkHospitals() {
  const { t } = useI18n();
  const heroImage = SAMPLE_HOSPITALS[1].coverImage;
  const features = [
    {
      icon: BadgeCheck,
      title: t("networkHospitals.feature.verification.title"),
      text: t("networkHospitals.feature.verification.text"),
    },
    {
      icon: Languages,
      title: t("networkHospitals.feature.languages.title"),
      text: t("networkHospitals.feature.languages.text"),
    },
    {
      icon: WalletCards,
      title: t("networkHospitals.feature.pricing.title"),
      text: t("networkHospitals.feature.pricing.text"),
    },
    {
      icon: CalendarDays,
      title: t("networkHospitals.feature.booking.title"),
      text: t("networkHospitals.feature.booking.text"),
    },
  ];

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
              {t("networkHospitals.hero.kicker")}
            </div>
            <h1 className="text-balance font-serif text-5xl sm:text-6xl">
              {t("networkHospitals.hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-100">
              {t("networkHospitals.hero.copy")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/admin/providers">
                <Button
                  size="lg"
                  className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  {t("networkHospitals.hero.ctaRegistry")}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/hospitals">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20"
                >
                  {t("networkHospitals.hero.ctaView")}
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
              {t("networkHospitals.manage.heading")}
            </h2>
            <p className="mt-3 text-ink-600">
              {t("networkHospitals.manage.copy")}
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
                <p className="text-sm leading-6 text-ink-700">{t(item)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding border-y border-ink-200 bg-ink-50">
        <div className="container-wide">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-serif text-4xl text-ink-950">
              {t("networkHospitals.onboarding.heading")}
            </h2>
            <p className="mt-3 text-ink-600">
              {t("networkHospitals.onboarding.copy")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {onboardingSteps.map(([step, titleKey, textKey]) => (
              <div
                key={step}
                className="rounded-lg border border-ink-200 bg-white p-5"
              >
                <div className="mb-6 font-serif text-3xl text-teal-700">
                  {step}
                </div>
                <h3 className="text-lg font-semibold text-ink-950">
                  {t(titleKey)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-ink-600">
                  {t(textKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-4 md:grid-cols-4">
          {features.map(item => (
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
              {t("networkHospitals.footer.kicker")}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">
              {t("networkHospitals.footer.copy")}
            </p>
          </div>
          <Link href="/admin/providers">
            <Button className="bg-white text-ink-950 hover:bg-ink-100">
              {t("networkHospitals.footer.cta")}
              <ListChecks className="size-4" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
