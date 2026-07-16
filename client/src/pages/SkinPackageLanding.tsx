import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Languages,
  MessageCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  formatUsdRange,
  getSkinLandingPage,
  getSkinPackageById,
  localizeSkinLandingPage,
  localizeSkinPackage,
  normalizeContentLocale,
  type SkinLandingPage,
  type SkinPackageSku,
} from "@/lib/wedgeData";
import { SAMPLE_HOSPITALS } from "@/lib/sampleData";
import { marketLabel as formatMarketLabel } from "@/lib/adminLabels";
import { cn } from "@/lib/utils";

const processCopy = {
  en: [
    [
      "Check eligibility",
      "We confirm foreign-patient fit and basic travel constraints before matching.",
    ],
    [
      "Match verified providers",
      "A coordinator shortlists clinics by registration, language, SLA, budget, and dates.",
    ],
    [
      "Receive separated quotes",
      "Medical fees, non-medical fees, deposit, and cancellation terms are shown separately.",
    ],
    [
      "Confirm booking",
      "If the quote works, pay a deposit and lock the visit schedule before travel.",
    ],
  ],
  jp: [
    [
      "適格性を確認",
      "外国人患者として相談可能か、渡航時期や基本条件を先に確認します。",
    ],
    [
      "認証済み医院を選定",
      "登録状況、対応言語、返信SLA、予算、日程をもとに候補を整理します。",
    ],
    [
      "分離された見積もり",
      "医療費、非医療費、予約金、キャンセル条件を分けて確認できます。",
    ],
    [
      "予約を確定",
      "見積もり条件に同意した後、予約金を支払い訪問日程を確定します。",
    ],
  ],
} as const;

const jpTrustCopy = {
  registration: [
    "登録確認",
    "外国人患者対応の登録状況を確認した医院のみ候補化します。",
  ],
  language: [
    "言語対応",
    "日本語または英語で相談内容を整理し、医院へ伝達します。",
  ],
  price: [
    "価格範囲",
    "医療費と非医療費を分け、予約前に見積もり条件を確認します。",
  ],
  schedule: [
    "日程調整",
    "渡航可能日と医院の空き枠を照合してから予約へ進みます。",
  ],
};

interface RemoteLandingContent {
  route: SkinLandingPage;
  packages: SkinPackageSku[];
}

export default function SkinPackageLanding() {
  const { locale, slug } = useParams<{ locale: string; slug: string }>();
  const [remoteContent, setRemoteContent] = useState<RemoteLandingContent | null>(
    null
  );
  const [remoteStatus, setRemoteStatus] = useState<
    "loading" | "ready" | "missing"
  >("loading");

  const staticPage = useMemo(() => {
    const page = getSkinLandingPage(locale, slug);
    return page ? localizeSkinLandingPage(page, locale) : undefined;
  }, [locale, slug]);

  useEffect(() => {
    const controller = new AbortController();
    setRemoteStatus("loading");
    setRemoteContent(null);

    const params = new URLSearchParams({
      locale: normalizeContentLocale(locale),
      slug: slug || "",
    });

    fetch(`/api/public/landing-content?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async response => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Landing content request failed.");
        return (await response.json()) as RemoteLandingContent;
      })
      .then(payload => {
        if (controller.signal.aborted) return;
        setRemoteContent(payload);
        setRemoteStatus(payload ? "ready" : "missing");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRemoteStatus("missing");
      });

    return () => controller.abort();
  }, [locale, slug]);

  const page = remoteContent?.route || staticPage;

  if (!page) {
    if (remoteStatus === "loading") {
      return (
        <Layout>
          <div className="container-wide py-24 text-center">
            <h1 className="mb-4 font-serif text-4xl text-ink-950">
              Loading landing content
            </h1>
          </div>
        </Layout>
      );
    }

    return (
      <Layout>
        <div className="container-wide py-24 text-center">
          <h1 className="mb-4 font-serif text-4xl text-ink-950">
            Landing page not found
          </h1>
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const pageLocale = normalizeContentLocale(String(locale || page.locale));
  const packages =
    remoteContent?.packages?.length
      ? remoteContent.packages.map(pkg => localizeSkinPackage(pkg, pageLocale))
      : page.packageIds
          .map(id => getSkinPackageById(id))
          .filter((item): item is SkinPackageSku => Boolean(item))
          .map(pkg => localizeSkinPackage(pkg, pageLocale));
  const dermatologyProviders = SAMPLE_HOSPITALS.filter(
    hospital =>
      hospital.specialty === "dermatology" || hospital.specialty === "wellness"
  ).slice(0, 3);
  const isJp = pageLocale === "ja";
  const copy = isJp ? processCopy.jp : processCopy.en;
  const landingMarketLabel =
    page.market === "japan" && isJp ? "日本" : formatMarketLabel(page.market);
  const consultationUrl = `/consultation?package=${packages[0]?.id ?? ""}&market=${page.market}&source_landing=/${page.locale}/${page.slug}`;

  const trustItems = [
    {
      icon: ShieldCheck,
      title: isJp ? jpTrustCopy.registration[0] : "Registration",
      text: isJp
        ? jpTrustCopy.registration[1]
        : "Verified-provider exposure gate",
    },
    {
      icon: Languages,
      title: isJp ? jpTrustCopy.language[0] : "Language",
      text: isJp
        ? jpTrustCopy.language[1]
        : "Japanese / English coordinator routing",
    },
    {
      icon: WalletCards,
      title: isJp ? jpTrustCopy.price[0] : "Price",
      text: isJp ? jpTrustCopy.price[1] : "Medical and non-medical fee split",
    },
    {
      icon: CalendarCheck,
      title: isJp ? jpTrustCopy.schedule[0] : "Schedule",
      text: isJp
        ? jpTrustCopy.schedule[1]
        : "Travel-window matching before deposit",
    },
  ];

  return (
    <Layout>
      <section className="clinical-grid border-b border-ink-200 bg-white">
        <div className="container-wide grid gap-10 py-12 lg:grid-cols-[1fr_430px] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-800">
                {isJp
                  ? `${landingMarketLabel}向け皮膚科パッケージ`
                  : `${landingMarketLabel} skin package wedge`}
              </span>
              <span className="rounded-md border border-ink-200 bg-white px-2.5 py-1 text-ink-600">
                {page.searchTheme}
              </span>
            </div>
            <h1 className="text-balance font-serif text-5xl text-ink-950 sm:text-6xl">
              {page.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-600">
              {page.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={consultationUrl}>
                <Button
                  size="lg"
                  className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                >
                  {page.cta}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="#packages">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-ink-300 px-6 text-ink-800"
                >
                  {page.secondaryCta}
                </Button>
              </a>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                [
                  "10",
                  isJp ? "グローバルランディング" : "global landing routes",
                ],
                ["24h", isJp ? "見積もり返信SLA" : "provider quote SLA"],
                ["0", isJp ? "規制違反目標" : "compliance incidents target"],
              ].map(([value, label]) => (
                <div key={label} className="border-l border-ink-200 pl-4">
                  <div className="font-serif text-3xl text-ink-950">
                    {value}
                  </div>
                  <div className="text-sm text-ink-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="soft-shadow rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="font-serif text-2xl text-ink-950">
              {isJp ? "見積もり準備チェック" : "Quote readiness check"}
            </h2>
            <div className="mt-5 grid gap-3">
              {trustItems.map(item => (
                <div
                  key={item.title}
                  className="flex gap-3 rounded-md border border-ink-200 p-3"
                >
                  <item.icon className="mt-0.5 size-5 text-teal-700" />
                  <div>
                    <div className="text-sm font-semibold text-ink-950">
                      {item.title}
                    </div>
                    <p className="text-xs leading-5 text-ink-500">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="packages" className="section-padding bg-ink-50">
        <div className="container-wide">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="font-serif text-4xl text-ink-950">
                {isJp
                  ? "検証用スキンパッケージ"
                  : "Skin package SKUs for validation"}
              </h2>
              <p className="mt-3 max-w-2xl text-ink-600">
                {isJp
                  ? "まずはリード検証用の価格帯です。最終的な適合性と価格は医療機関の確認後に確定します。"
                  : "These packages are designed for lead testing first. Final treatment suitability and price are confirmed by providers."}
              </p>
            </div>
            <Link href={consultationUrl}>
              <Button className="bg-ink-950 text-white hover:bg-ink-800">
                {isJp ? "パッケージ相談を送信" : "Submit package request"}
              </Button>
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {packages.map(pkg => (
              <PackageCard key={pkg.id} pkg={pkg} selected />
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2 className="font-serif text-4xl text-ink-950">
              {isJp
                ? "自動化前にコーディネーターが手動で確認"
                : "Manual matching before full automation"}
            </h2>
            <p className="mt-4 text-lg leading-8 text-ink-600">
              {isJp
                ? "最初の100件は、実際の返信速度、予算、渡航日程、見積もり受諾率を見ながら手動でマッチングします。"
                : "The first 100 leads should be routed manually so the matching formula learns from real provider response, patient budget, travel dates, and quote acceptance."}
            </p>
            <div className="mt-6 rounded-lg border border-coral-200 bg-coral-50 p-5 text-sm leading-6 text-ink-700">
              {isJp
                ? "治療効果は保証しません。予約金の前に、適格性、医院の対応状況、見積もりの明確性を確認します。"
                : "No treatment outcome is guaranteed. The platform validates eligibility, provider readiness, and quote clarity before a patient pays a deposit."}
            </div>
          </div>
          <div className="grid gap-3">
            {copy.map(([title, text], index) => (
              <div
                key={title}
                className="grid gap-4 rounded-lg border border-ink-200 p-4 sm:grid-cols-[48px_1fr]"
              >
                <div className="grid size-12 place-items-center rounded-md bg-teal-50 font-serif text-xl text-teal-800">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-ink-950">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-ink-950 text-white">
        <div className="container-wide">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-serif text-4xl">
              {isJp
                ? "マッチング前に確認できる医院の信頼要素"
                : "Provider trust signals shown before matching"}
            </h2>
            <p className="mt-3 text-ink-300">
              {isJp
                ? "登録確認、保険情報、対応言語、返信SLA、価格範囲を公開ページで見せ、広告表示がある場合は明示します。"
                : "Public pages should highlight verification status, insurance evidence, language coverage, SLA, and package range."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {dermatologyProviders.map(hospital => (
              <div
                key={hospital.id}
                className="rounded-lg border border-white/15 bg-white/5 p-5"
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-teal-200">
                  <CheckCircle2 className="size-4" />
                  {hospital.registrationLabel}
                </div>
                <h3 className="font-serif text-2xl">{hospital.nameEn}</h3>
                <div className="mt-4 grid gap-2 text-sm text-ink-300">
                  <div>
                    {isJp ? "対応言語" : "Languages"}:{" "}
                    {hospital.languages.slice(0, 4).join(", ").toUpperCase()}
                  </div>
                  <div>
                    {isJp ? "返信SLA" : "SLA"}:{" "}
                    {isJp
                      ? `${hospital.responseSlaHours}時間以内目標`
                      : `quote reply target under ${hospital.responseSlaHours}h`}
                  </div>
                  <div>
                    {isJp ? "価格範囲" : "Package range"}:{" "}
                    {formatUsdRange(
                      hospital.packagePriceMinUsd,
                      hospital.packagePriceMaxUsd
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="container-wide flex flex-col justify-between gap-4 rounded-lg border border-ink-200 p-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-700">
              <MessageCircle className="size-4" />
              {isJp ? "コーディネーターCRM検証" : "Coordinator CRM validation"}
            </div>
            <h2 className="mt-2 font-serif text-3xl text-ink-950">
              {isJp
                ? "このランディング経路でリードを検証"
                : "Ready to test this landing path?"}
            </h2>
            <p className="mt-2 text-ink-600">
              {isJp
                ? "フォームではパッケージ、対象市場、適格性、予算、渡航時期、流入元を保存します。"
                : "The form captures package, market, eligibility, budget, travel window, and source landing."}
            </p>
          </div>
          <Link href={consultationUrl}>
            <Button
              size="lg"
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              {page.cta}
              <ClipboardCheck className="size-4" />
            </Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

export function PackageCard({
  pkg,
  selected = false,
}: {
  pkg: SkinPackageSku;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "card-hover h-full rounded-lg border bg-white p-5",
        selected ? "border-teal-300 shadow-sm" : "border-ink-200"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-normal text-teal-700">
            {pkg.id}
          </div>
          <h3 className="mt-1 font-serif text-2xl text-ink-950">{pkg.title}</h3>
        </div>
        <span className="rounded-md bg-ink-50 px-2 py-1 text-xs font-semibold text-ink-700">
          {pkg.durationDays} day
        </span>
      </div>
      <p className="text-sm leading-6 text-ink-600">{pkg.bestFor}</p>
      <div className="mt-5 grid gap-2 text-sm">
        <div className="flex items-center justify-between rounded-md bg-teal-50 px-3 py-2">
          <span className="font-semibold text-teal-900">Package range</span>
          <span className="font-semibold text-teal-900">
            {formatUsdRange(pkg.priceMinUsd, pkg.priceMaxUsd)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-ink-50 px-3 py-2">
          <span className="font-semibold text-ink-700">Recovery</span>
          <span className="text-ink-700">{pkg.recoveryWindow}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-ink-50 px-3 py-2">
          <span className="font-semibold text-ink-700">Coordinator</span>
          <span className="text-ink-700">
            {pkg.coordinatorLanguages.join(", ").toUpperCase()}
          </span>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {pkg.includes.map(item => (
          <div key={item} className="flex gap-2 text-sm text-ink-700">
            <CheckCircle2 className="mt-0.5 size-4 text-teal-700" />
            {item}
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-ink-100 pt-4 text-xs leading-5 text-ink-500">
        {pkg.complianceNote}
      </p>
    </div>
  );
}
