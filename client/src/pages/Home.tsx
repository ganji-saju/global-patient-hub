import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  Handshake,
  HeartPulse,
  Languages,
  MapPin,
  Plane,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { PackageCard } from "@/pages/SkinPackageLanding";
import {
  formatKRW,
  formatUSD,
  getLocalizedHospitalDescription,
  getLocalizedHospitalName,
  getLocalizedTreatmentName,
  SAMPLE_HOSPITALS,
  SAMPLE_HOSPITAL_TREATMENTS,
  SAMPLE_TREATMENTS,
  SPECIALTY_LABELS,
  SPECIALTY_TRANSLATION_KEYS,
} from "@/lib/sampleData";
import {
  SKIN_PACKAGE_SKUS,
  localizeSkinPackage,
  type SkinPackageSku,
} from "@/lib/wedgeData";
import { cn } from "@/lib/utils";

const goals = [
  { key: "plastic_surgery", labelKey: "home.goals.plastic", icon: Sparkles },
  { key: "dermatology", labelKey: "home.goals.skin", icon: HeartPulse },
  { key: "dental", labelKey: "home.goals.dental", icon: Stethoscope },
  { key: "wellness", labelKey: "home.goals.wellness", icon: ClipboardList },
];

const liveInquiries = [
  {
    country: "Japan",
    flagCode: "jp",
    name: "Mika T.",
    treatment: "Laser toning",
    time: "2 min ago",
  },
  {
    country: "Taiwan",
    flagCode: "tw",
    name: "Wei L.",
    treatment: "Skin booster",
    time: "5 min ago",
  },
  {
    country: "USA",
    flagCode: "us",
    name: "Sarah K.",
    treatment: "Facial contour",
    time: "8 min ago",
  },
  {
    country: "Singapore",
    flagCode: "sg",
    name: "Mei L.",
    treatment: "Dental veneer",
    time: "12 min ago",
  },
  {
    country: "UAE",
    flagCode: "ae",
    name: "Noor A.",
    treatment: "Premium checkup",
    time: "15 min ago",
  },
  {
    country: "Canada",
    flagCode: "ca",
    name: "Daniel P.",
    treatment: "Hair transplant",
    time: "18 min ago",
  },
];

const rollingLiveInquiries = [...liveInquiries, ...liveInquiries.slice(0, 3)];

function LiveInquiryTicker() {
  return (
    <div className="live-inquiry-feed" aria-label="Recent patient inquiries">
      <div className="live-inquiry-track">
        {rollingLiveInquiries.map((inquiry, index) => (
          <div
            key={`${inquiry.country}-${inquiry.name}-${index}`}
            className="live-inquiry-row"
          >
            <span
              className="live-inquiry-flag"
              aria-label={inquiry.country}
              title={inquiry.country}
            >
              <img
                src={`https://flagcdn.com/w40/${inquiry.flagCode}.png`}
                srcSet={`https://flagcdn.com/w40/${inquiry.flagCode}.png 1x, https://flagcdn.com/w80/${inquiry.flagCode}.png 2x`}
                alt=""
                className="live-inquiry-flag-image"
                loading="lazy"
              />
            </span>
            <span className="live-inquiry-name">{inquiry.name}</span>
            <span className="live-inquiry-treatment">{inquiry.treatment}</span>
            <span className="live-inquiry-time">{inquiry.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroSection() {
  const { lang, t } = useI18n();
  const [goal, setGoal] = useState("dermatology");

  const matches = useMemo(() => {
    return SAMPLE_HOSPITALS.filter(
      hospital => hospital.specialty === goal || goal === "wellness"
    ).slice(0, 3);
  }, [goal]);

  const actors = [
    {
      icon: HeartPulse,
      eyebrow: t("publicHome.network.actor.patient.eyebrow"),
      title: t("publicHome.network.actor.patient.title"),
      text: t("publicHome.network.actor.patient.text"),
    },
    {
      icon: Building2,
      eyebrow: t("publicHome.network.actor.hospital.eyebrow"),
      title: t("publicHome.network.actor.hospital.title"),
      text: t("publicHome.network.actor.hospital.text"),
    },
    {
      icon: Handshake,
      eyebrow: t("publicHome.network.actor.partner.eyebrow"),
      title: t("publicHome.network.actor.partner.title"),
      text: t("publicHome.network.actor.partner.text"),
    },
  ];

  const flow = [
    {
      icon: UserRoundCheck,
      title: t("publicHome.network.flow.patient.title"),
      detail: t("publicHome.network.flow.patient.detail"),
    },
    {
      icon: ShieldCheck,
      title: t("publicHome.network.flow.routing.title"),
      detail: t("publicHome.network.flow.routing.detail"),
    },
    {
      icon: Scale,
      title: t("publicHome.network.flow.quote.title"),
      detail: t("publicHome.network.flow.quote.detail"),
    },
    {
      icon: CalendarCheck,
      title: t("publicHome.network.flow.booking.title"),
      detail: t("publicHome.network.flow.booking.detail"),
    },
  ];

  return (
    <section className="hero-atlas border-b border-ink-200">
      <div className="container-wide grid min-h-[700px] gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
        <div className="max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-teal-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-800">
            <Languages className="size-4" />
            {t("publicHome.network.kicker")}
          </div>
          <h1 className="text-balance font-serif text-5xl text-ink-950 sm:text-6xl lg:text-7xl">
            {t("publicHome.network.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-600">
            {t("publicHome.network.copy")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/consultation">
              <Button
                size="lg"
                className="btn-scale h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
              >
                {t("publicHome.network.primary")}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/network">
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-ink-300 px-6 text-ink-800 hover:bg-ink-50"
              >
                {t("publicHome.network.secondary")}
                <Handshake className="size-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-10 grid gap-3 lg:grid-cols-3">
            {actors.map(actor => (
              <div
                key={actor.eyebrow}
                className="rounded-lg border border-ink-200 bg-white p-4"
              >
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-teal-700">
                  <actor.icon className="size-4" />
                  {actor.eyebrow}
                </div>
                <h2 className="text-lg font-semibold text-ink-950">
                  {actor.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  {actor.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="soft-shadow rounded-lg border border-ink-200 bg-white p-5">
          <div className="mb-5 flex items-center justify-between border-b border-ink-100 pb-4">
            <div>
              <h2 className="font-serif text-2xl text-ink-950">
                {t("publicHome.network.map.title")}
              </h2>
              <p className="text-sm text-ink-500">
                {t("publicHome.network.map.copy")}
              </p>
            </div>
            <div className="grid size-10 place-items-center rounded-md bg-teal-50 text-teal-700">
              <ShieldCheck className="size-5" />
            </div>
          </div>

          <LiveInquiryTicker />

          <div className="mt-5 grid gap-2">
            {flow.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-3 rounded-md border border-ink-200 bg-ink-50 p-3"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-white text-teal-700">
                  <step.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-400">
                      0{index + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-ink-950">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink-500">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium text-ink-700">
              {t("publicHome.network.map.preview")}
              <select
                value={goal}
                onChange={event => setGoal(event.target.value)}
                className="h-11 rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              >
                {goals.map(item => (
                  <option key={item.key} value={item.key}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-ink-200 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                  <MapPin className="size-3.5 text-teal-700" />
                  {t("publicHome.network.map.destination")}
                </div>
                <div className="mt-1 text-sm text-ink-950">
                  {t("publicHome.network.map.destinationValue")}
                </div>
              </div>
              <div className="rounded-md border border-ink-200 p-3">
                <div className="text-xs font-semibold text-ink-500">
                  {t("publicHome.network.map.typicalRequest")}
                </div>
                <div className="mt-1 text-sm text-ink-950">$700 - $3k</div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {matches.map(hospital => (
              <Link key={hospital.id} href={`/hospitals/${hospital.slug}`}>
                <div className="card-hover flex gap-3 rounded-md border border-ink-200 p-3 hover:border-teal-300">
                  <img
                    src={hospital.coverImage}
                    alt={hospital.nameEn}
                    className="size-16 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold text-ink-950">
                        {getLocalizedHospitalName(hospital, lang)}
                      </h3>
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs font-semibold text-teal-700">
                        {hospital.rating}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500">
                      {hospital.highlights.join(" / ")}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WedgeSection() {
  const { t, lang } = useI18n();
  const [remotePackages, setRemotePackages] = useState<SkinPackageSku[]>([]);
  const featuredPackages = useMemo(
    () =>
      (remotePackages.length ? remotePackages : SKIN_PACKAGE_SKUS.slice(0, 3)).map(
        pkg => localizeSkinPackage(pkg, lang)
      ),
    [lang, remotePackages]
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ locale: lang, limit: "3" });

    fetch(`/api/public/package-skus?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) return { packages: [] as SkinPackageSku[] };
        return (await response.json()) as { packages?: SkinPackageSku[] };
      })
      .then(payload => {
        if (!controller.signal.aborted) setRemotePackages(payload.packages ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRemotePackages([]);
      });

    return () => controller.abort();
  }, [lang]);

  return (
    <section className="section-padding bg-white">
      <div className="container-wide">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <h2 className="font-serif text-4xl text-ink-950">
              {t("publicHome.wedge.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-ink-600">
              {t("publicHome.wedge.copy")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                t("publicHome.wedge.trust.title"),
                t("publicHome.wedge.trust.text"),
              ],
              [
                t("publicHome.wedge.language.title"),
                t("publicHome.wedge.language.text"),
              ],
              [
                t("publicHome.wedge.recovery.title"),
                t("publicHome.wedge.recovery.text"),
              ],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-lg border border-ink-200 bg-ink-50 p-4"
              >
                <div className="font-semibold text-ink-950">{title}</div>
                <p className="mt-1 text-sm leading-5 text-ink-500">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {featuredPackages.map(pkg => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategorySection() {
  const { t } = useI18n();

  const categories = [
    {
      key: "plastic_surgery",
      title: t("cat.plastic"),
      image: SAMPLE_TREATMENTS[0].coverImage,
    },
    {
      key: "dermatology",
      title: t("cat.dermatology"),
      image: SAMPLE_TREATMENTS[2].coverImage,
    },
    {
      key: "dental",
      title: t("cat.dental"),
      image: SAMPLE_TREATMENTS[4].coverImage,
    },
    {
      key: "hair",
      title: t("cat.hair"),
      image: SAMPLE_TREATMENTS[5].coverImage,
    },
    {
      key: "wellness",
      title: t("cat.wellness"),
      image: SAMPLE_TREATMENTS[6].coverImage,
    },
  ];

  return (
    <section className="section-padding bg-ink-50">
      <div className="container-wide">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-serif text-4xl text-ink-950">
              {t("cat.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-ink-600">
              {t("home.category.subtitle")}
            </p>
          </div>
          <Link href="/treatments">
            <Button variant="outline" className="border-ink-300 text-ink-800">
              {t("common.seeAll")}
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          {categories.map(category => (
            <Link key={category.key} href={`/treatments?cat=${category.key}`}>
              <div className="card-hover overflow-hidden rounded-lg border border-ink-200 bg-white">
                <img
                  src={category.image}
                  alt={category.title}
                  className="h-40 w-full object-cover"
                />
                <div className="p-4">
                  <h3 className="font-semibold text-ink-950">
                    {category.title}
                  </h3>
                  <p className="mt-2 text-sm leading-5 text-ink-500">
                    {t("home.category.cardCopy")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedHospitals() {
  const { t, lang } = useI18n();
  const featured = SAMPLE_HOSPITALS.filter(hospital => hospital.featured).slice(
    0,
    3
  );

  return (
    <section className="section-padding bg-white">
      <div className="container-wide">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="font-serif text-4xl text-ink-950">
              {t("hospitals.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-ink-600">
              {t("hospitals.subtitle")}
            </p>
          </div>
          <Link href="/hospitals">
            <Button className="bg-ink-950 text-white hover:bg-ink-800">
              {t("hospitals.viewAll")}
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-ink-200">
          {featured.map((hospital, index) => (
            <Link key={hospital.id} href={`/hospitals/${hospital.slug}`}>
              <div
                className={cn(
                  "grid gap-4 bg-white p-4 transition-colors hover:bg-teal-50/40 md:grid-cols-[180px_1fr_210px]",
                  index > 0 && "border-t border-ink-200"
                )}
              >
                <img
                  src={hospital.coverImage}
                  alt={hospital.nameEn}
                  className="h-32 w-full rounded-md object-cover"
                />
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded border px-2 py-1 text-xs font-semibold",
                        SPECIALTY_LABELS[hospital.specialty].color
                      )}
                    >
                      {t(SPECIALTY_TRANSLATION_KEYS[hospital.specialty])}
                    </span>
                    <span className="text-sm font-semibold text-ink-700">
                      {hospital.rating} {t("home.featured.rating")}
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl text-ink-950">
                    {getLocalizedHospitalName(hospital, lang)}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-600">
                    {getLocalizedHospitalDescription(hospital, lang)}
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="rounded-md bg-ink-50 p-3">
                    <div className="text-xs font-semibold text-ink-500">
                      {t("home.featured.languages")}
                    </div>
                    <div className="mt-1 text-ink-950">
                      {hospital.languages.join(", ").toUpperCase()}
                    </div>
                  </div>
                  <div className="rounded-md bg-coral-50 p-3">
                    <div className="text-xs font-semibold text-coral-700">
                      {t("home.featured.coordinatorNote")}
                    </div>
                    <div className="mt-1 text-ink-900">
                      {hospital.highlights[0]}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  const { t } = useI18n();
  const steps = [
    {
      icon: ClipboardList,
      title: t("publicHome.process.request.title"),
      text: t("publicHome.process.request.text"),
    },
    {
      icon: Scale,
      title: t("publicHome.process.match.title"),
      text: t("publicHome.process.match.text"),
    },
    {
      icon: CalendarCheck,
      title: t("publicHome.process.quote.title"),
      text: t("publicHome.process.quote.text"),
    },
    {
      icon: Plane,
      title: t("publicHome.process.booking.title"),
      text: t("publicHome.process.booking.text"),
    },
  ];

  return (
    <section
      id="process"
      className="section-padding border-y border-ink-200 bg-ink-950 text-white"
    >
      <div className="container-wide">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-serif text-4xl">
            {t("publicHome.process.title")}
          </h2>
          <p className="mt-3 text-ink-300">{t("publicHome.process.copy")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-lg border border-white/15 bg-white/5 p-5"
            >
              <step.icon className="mb-5 size-6 text-teal-300" />
              <div className="mb-2 text-xs font-semibold text-coral-200">
                0{index + 1}
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-300">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ConsultationPreview() {
  const { lang, t } = useI18n();
  const popular = SAMPLE_TREATMENTS.filter(
    treatment => treatment.popular
  ).slice(0, 4);
  const firstPrice = SAMPLE_HOSPITAL_TREATMENTS[2].priceKrw;

  return (
    <section className="section-padding bg-white">
      <div className="container-wide grid gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <h2 className="font-serif text-4xl text-ink-950">
            {t("publicHome.consult.title")}
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-600">
            {t("publicHome.consult.copy")}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, text: t("publicHome.consult.eligibility") },
              { icon: CalendarCheck, text: t("publicHome.consult.schedule") },
              { icon: Scale, text: t("publicHome.consult.fees") },
              { icon: Plane, text: t("publicHome.consult.booking") },
            ].map(item => (
              <div
                key={item.text}
                className="flex gap-3 rounded-md border border-ink-200 p-4"
              >
                <item.icon className="size-5 text-teal-700" />
                <span className="text-sm font-medium text-ink-800">
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-ink-200 bg-ink-50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-2xl text-ink-950">
              {t("publicHome.consult.quoteSnapshot")}
            </h3>
            <span className="rounded bg-teal-100 px-2 py-1 text-xs font-bold text-teal-800">
              {t("publicHome.consult.liveForm")}
            </span>
          </div>
          <div className="space-y-3">
            {popular.map(treatment => (
              <div
                key={treatment.id}
                className="flex items-center justify-between rounded-md bg-white p-3 text-sm"
              >
                <span className="font-medium text-ink-800">
                  {getLocalizedTreatmentName(treatment, lang)}
                </span>
                <span className="text-ink-500">
                  {formatUSD(treatment.priceMin)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-coral-50 p-4 text-sm text-ink-700">
            {t("publicHome.consult.examplePrefix")} {formatKRW(firstPrice)}.{" "}
            {t("publicHome.consult.exampleSuffix")}
          </div>
          <Link href="/consultation">
            <Button className="mt-4 w-full bg-teal-700 text-white hover:bg-teal-800">
              {t("publicHome.consult.openForm")}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <WedgeSection />
      <CategorySection />
      <FeaturedHospitals />
      <ProcessSection />
      <ConsultationPreview />
    </Layout>
  );
}
