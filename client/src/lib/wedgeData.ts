import type { LanguageCode } from "./sampleData";
import type { LandingLocale, WedgeMarket } from "./landingRouteOptions";
export type { LandingLocale, WedgeMarket } from "./landingRouteOptions";

export interface LocalizedSkinPackageCopy {
  title?: string;
  shortTitle?: string;
  recoveryWindow?: string;
  bestFor?: string;
  includes?: string[];
  complianceNote?: string;
}

export interface LocalizedSkinLandingCopy {
  intent?: string;
  title?: string;
  subtitle?: string;
  searchTheme?: string;
  cta?: string;
  secondaryCta?: string;
}

export interface SkinPackageSku {
  id: string;
  title: string;
  shortTitle: string;
  market: WedgeMarket | "both";
  treatmentSlug: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  durationDays: number;
  recoveryWindow: string;
  coordinatorLanguages: LanguageCode[];
  includes: string[];
  bestFor: string;
  complianceNote: string;
  translations?: Record<string, LocalizedSkinPackageCopy>;
  translationSourceLocale?: string;
}

export interface SkinLandingPage {
  locale: LandingLocale;
  slug: string;
  market: WedgeMarket;
  intent: string;
  title: string;
  subtitle: string;
  searchTheme: string;
  cta: string;
  secondaryCta: string;
  packageIds: string[];
  translations?: Record<string, LocalizedSkinLandingCopy>;
  translationSourceLocale?: string;
}

const LOCALE_ALIASES: Record<string, string> = {
  jp: "ja",
  ja: "ja",
  "zh-cn": "zh",
  "zh-tw": "zh",
};

export function normalizeContentLocale(locale: string | undefined) {
  const normalized = (locale || "en").toLowerCase();
  return LOCALE_ALIASES[normalized] || normalized;
}

function localizedCopy<T>(
  translations: Record<string, T> | undefined,
  locale: string | undefined
) {
  const normalized = normalizeContentLocale(locale);
  return (
    translations?.[normalized] ||
    translations?.[locale || ""] ||
    translations?.en ||
    translations?.ko ||
    null
  );
}

export function localizeSkinPackage(
  pkg: SkinPackageSku,
  locale: string | undefined
): SkinPackageSku {
  const copy = localizedCopy(pkg.translations, locale);
  if (!copy) return pkg;
  return {
    ...pkg,
    title: String(copy.title || copy.shortTitle || pkg.title),
    shortTitle: String(copy.shortTitle || copy.title || pkg.shortTitle),
    recoveryWindow: String(copy.recoveryWindow || pkg.recoveryWindow),
    bestFor: String(copy.bestFor || pkg.bestFor),
    includes: Array.isArray(copy.includes) ? copy.includes : pkg.includes,
    complianceNote: String(copy.complianceNote || pkg.complianceNote),
  };
}

export function localizeSkinLandingPage(
  page: SkinLandingPage,
  locale: string | undefined
): SkinLandingPage {
  const copy = localizedCopy(page.translations, locale);
  if (!copy) return page;
  return {
    ...page,
    intent: String(copy.intent || page.intent),
    title: String(copy.title || page.title),
    subtitle: String(copy.subtitle || page.subtitle),
    searchTheme: String(copy.searchTheme || page.searchTheme),
    cta: String(copy.cta || page.cta),
    secondaryCta: String(copy.secondaryCta || page.secondaryCta),
  };
}

export const SKIN_PACKAGE_SKUS: SkinPackageSku[] = [
  {
    id: "jp-skin-01",
    title: "Gangnam Laser Toning Starter",
    shortTitle: "Laser toning",
    market: "japan",
    treatmentSlug: "laser-toning",
    priceMinUsd: 700,
    priceMaxUsd: 1200,
    durationDays: 1,
    recoveryWindow: "0-2 days",
    coordinatorLanguages: ["ja", "en"],
    bestFor:
      "Short Seoul beauty trips and first-time Korea skin clinic visitors from Japan.",
    includes: [
      "Skin analysis",
      "Laser toning estimate",
      "Low-downtime schedule",
      "Aftercare checklist",
    ],
    complianceNote:
      "Final treatment plan and price must be confirmed after provider consultation.",
  },
  {
    id: "jp-skin-02",
    title: "Weekend Anti-Aging Skin Booster",
    shortTitle: "Skin booster",
    market: "japan",
    treatmentSlug: "skin-booster",
    priceMinUsd: 1200,
    priceMaxUsd: 2200,
    durationDays: 2,
    recoveryWindow: "1-3 days",
    coordinatorLanguages: ["ja", "en"],
    bestFor:
      "Japanese patients comparing hydration, texture, and early anti-aging options.",
    includes: [
      "Doctor review",
      "Booster estimate",
      "Recovery-light scheduling",
      "Japanese follow-up notes",
    ],
    complianceNote:
      "Injectable suitability depends on medical review and provider protocol.",
  },
  {
    id: "jp-skin-03",
    title: "Acne Scar Laser Planning Package",
    shortTitle: "Acne scar plan",
    market: "japan",
    treatmentSlug: "acne-scar-laser",
    priceMinUsd: 1500,
    priceMaxUsd: 3000,
    durationDays: 3,
    recoveryWindow: "3-7 days",
    coordinatorLanguages: ["ja", "en"],
    bestFor:
      "Patients who need structured expectations before booking a laser program.",
    includes: [
      "Photo-based pre-screen",
      "Laser plan estimate",
      "Downtime guidance",
      "Provider quote comparison",
    ],
    complianceNote:
      "Improvement level cannot be guaranteed; provider review is required.",
  },
  {
    id: "tw-skin-01",
    title: "Taiwan Traveler Premium Skin Package",
    shortTitle: "Premium skin",
    market: "taiwan",
    treatmentSlug: "skin-booster",
    priceMinUsd: 900,
    priceMaxUsd: 1800,
    durationDays: 2,
    recoveryWindow: "1-3 days",
    coordinatorLanguages: ["en", "zh"],
    bestFor:
      "Taiwan travelers comparing premium Korean dermatology programs through an English quote flow.",
    includes: [
      "Clinic shortlist",
      "Skin booster or toning quote",
      "Travel-window matching",
      "English coordinator",
    ],
    complianceNote:
      "Traditional Chinese support is captured as an operating requirement, not a live landing locale in v1.",
  },
  {
    id: "tw-skin-02",
    title: "Taiwan 3-Day Skin and Recovery Add-On",
    shortTitle: "3-day recovery",
    market: "taiwan",
    treatmentSlug: "recovery-care",
    priceMinUsd: 1500,
    priceMaxUsd: 3000,
    durationDays: 3,
    recoveryWindow: "0-3 days",
    coordinatorLanguages: ["en", "zh"],
    bestFor:
      "Patients who want treatment scheduling plus recovery and concierge options.",
    includes: [
      "Skin treatment estimate",
      "Recovery care option",
      "Non-medical fee separation",
      "Deposit-ready schedule",
    ],
    complianceNote:
      "Medical and non-medical fees are quoted separately before deposit.",
  },
];

export const SKIN_LANDING_PAGES: SkinLandingPage[] = [
  {
    locale: "en",
    slug: "korea-skin-clinic-gangnam",
    market: "japan",
    intent: "Korea skin clinic Gangnam",
    title: "Compare verified Gangnam skin clinics before you fly",
    subtitle:
      "A coordinator-led quote flow for Japan and Taiwan patients seeking transparent skin package estimates in Seoul.",
    searchTheme: "Gangnam clinic comparison",
    cta: "Get matched skin quotes",
    secondaryCta: "View skin packages",
    packageIds: ["jp-skin-01", "jp-skin-02", "tw-skin-01"],
  },
  {
    locale: "en",
    slug: "korea-laser-toning-package",
    market: "japan",
    intent: "Korea laser toning package",
    title: "Laser toning packages with language-supported coordination",
    subtitle:
      "Compare low-downtime laser toning estimates, provider response times, and travel windows.",
    searchTheme: "Laser toning package",
    cta: "Request laser quote",
    secondaryCta: "Compare providers",
    packageIds: ["jp-skin-01", "tw-skin-01"],
  },
  {
    locale: "en",
    slug: "korea-skin-booster-package",
    market: "taiwan",
    intent: "Korea skin booster price",
    title: "Skin booster quote matching for Seoul visits",
    subtitle:
      "See price ranges, recovery windows, verified provider signals, and coordinator next steps.",
    searchTheme: "Skin booster estimate",
    cta: "Request booster estimate",
    secondaryCta: "See packages",
    packageIds: ["jp-skin-02", "tw-skin-01"],
  },
  {
    locale: "en",
    slug: "seoul-anti-aging-skin-package",
    market: "japan",
    intent: "Seoul anti-aging treatment",
    title: "Anti-aging skin packages planned around short Seoul stays",
    subtitle:
      "Match your dates, budget, and language needs with provider quote options before booking.",
    searchTheme: "Anti-aging weekend",
    cta: "Plan my Seoul skin trip",
    secondaryCta: "Start consultation",
    packageIds: ["jp-skin-02", "tw-skin-02"],
  },
  {
    locale: "en",
    slug: "korea-acne-scar-laser-package",
    market: "japan",
    intent: "Korea acne scar laser",
    title: "Acne scar laser planning without unclear price surprises",
    subtitle:
      "Submit goals and photos later; receive structured provider estimates and downtime guidance.",
    searchTheme: "Acne scar laser",
    cta: "Ask a coordinator",
    secondaryCta: "Review package",
    packageIds: ["jp-skin-03"],
  },
  {
    locale: "jp",
    slug: "korea-skin-clinic-gangnam",
    market: "japan",
    intent: "韓国 江南 皮膚科 比較",
    title: "渡航前に江南の提携候補クリニックを比較",
    subtitle:
      "日本・台湾在住の方に向けて、価格帯、対応言語、予約可能日、コーディネーターの流れを事前に整理します。",
    searchTheme: "江南クリニック比較",
    cta: "スキン施術の見積もりを依頼",
    secondaryCta: "パッケージを見る",
    packageIds: ["jp-skin-01", "jp-skin-02", "jp-skin-03"],
  },
  {
    locale: "jp",
    slug: "korea-laser-toning-package",
    market: "japan",
    intent: "韓国 レーザートーニング パッケージ",
    title: "短期滞在向けレーザートーニング見積もり",
    subtitle:
      "ダウンタイムの目安、価格帯、対応言語、予約候補日を確認し、来院前にコーディネーターが候補を整理します。",
    searchTheme: "レーザートーニング",
    cta: "レーザー見積もりを依頼",
    secondaryCta: "候補を比較",
    packageIds: ["jp-skin-01"],
  },
  {
    locale: "jp",
    slug: "korea-skin-booster-package",
    market: "japan",
    intent: "韓国 スキンブースター 価格",
    title: "スキンブースター施術の価格帯と候補を確認",
    subtitle:
      "保湿、ハリ、肌質改善などの希望をもとに、医療機関の確認後に最終プランと費用を案内します。",
    searchTheme: "スキンブースター見積もり",
    cta: "ブースター見積もりを依頼",
    secondaryCta: "パッケージを見る",
    packageIds: ["jp-skin-02"],
  },
  {
    locale: "jp",
    slug: "seoul-anti-aging-skin-package",
    market: "japan",
    intent: "ソウル アンチエイジング 皮膚施術",
    title: "週末ソウル滞在に合わせたエイジングケア相談",
    subtitle:
      "渡航日程、予算、希望言語に合わせて、候補クリニックの見積もりと予約までの流れを整理します。",
    searchTheme: "週末エイジングケア",
    cta: "ソウル美容渡航を相談",
    secondaryCta: "相談を開始",
    packageIds: ["jp-skin-02"],
  },
  {
    locale: "jp",
    slug: "korea-acne-scar-laser-package",
    market: "japan",
    intent: "韓国 ニキビ跡 レーザー",
    title: "ニキビ跡レーザーの計画を価格の不安なく相談",
    subtitle:
      "改善効果を保証するものではありません。写真提出は後段で行い、医療機関の確認後に見積もりとダウンタイム目安を案内します。",
    searchTheme: "ニキビ跡レーザー",
    cta: "コーディネーターに相談",
    secondaryCta: "パッケージを確認",
    packageIds: ["jp-skin-03"],
  },
];

export function getSkinPackageById(id: string) {
  return SKIN_PACKAGE_SKUS.find(item => item.id === id);
}

export function getSkinLandingPage(
  locale: string | undefined,
  slug: string | undefined
) {
  return SKIN_LANDING_PAGES.find(
    page => page.locale === locale && page.slug === slug
  );
}

export function formatUsdRange(min: number, max: number) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return `${formatter.format(min)} - ${formatter.format(max)}`;
}
