import { useMemo, useState, type ReactNode } from "react";
import { useSearch } from "wouter";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  Globe2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, useI18n } from "@/contexts/I18nContext";
import {
  getLocalizedHospitalName,
  getLocalizedTreatmentName,
  SAMPLE_HOSPITALS,
  SAMPLE_TREATMENTS,
} from "@/lib/sampleData";
import {
  isSupabaseConfigured,
  submitInquiry,
  type InquiryResult,
} from "@/lib/supabase";
import { getSkinPackageById, SKIN_PACKAGE_SKUS } from "@/lib/wedgeData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FormData {
  name: string;
  email: string;
  phone?: string;
  nationality?: string;
  residenceCountry?: string;
  preferredLanguage: string;
  treatmentInterest?: string;
  packageInterest?: string;
  market?: string;
  hospitalSlug?: string;
  preferredDate?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  budget?: string;
  message?: string;
  partnerAssistanceMode: string;
  partnerServices?: string[];
  partnerShareConsent?: boolean;
  hasKoreanNationalHealthInsurance?: boolean;
  hasKoreanAlienRegistration?: boolean;
  hasOverseasKoreanResidenceReport?: boolean;
  consentMarketing?: boolean;
  consent: boolean;
}

const BUDGETS = [
  { label: "Under $1,000", min: 0, max: 1000 },
  { label: "$1,000 - $3,000", min: 1000, max: 3000 },
  { label: "$3,000 - $5,000", min: 3000, max: 5000 },
  { label: "$5,000 - $10,000", min: 5000, max: 10000 },
  { label: "$10,000 - $20,000", min: 10000, max: 20000 },
  { label: "Over $20,000", min: 20000, max: 50000 },
  { label: "Flexible", min: undefined, max: undefined },
];

const MARKET_OPTIONS = [
  { value: "japan", label: "Japan" },
  { value: "taiwan", label: "Taiwan" },
  { value: "china", label: "China / Hong Kong" },
  { value: "southeast_asia", label: "Southeast Asia" },
  { value: "north_america", label: "North America" },
  { value: "middle_east", label: "Middle East" },
  { value: "europe", label: "Europe" },
  { value: "other", label: "Other market" },
];

const PARTNER_ASSISTANCE_MODES = [
  { value: "platform_direct", labelKey: "consult.partnerMode.platformDirect" },
  {
    value: "partner_requested",
    labelKey: "consult.partnerMode.partnerRequested",
  },
  {
    value: "partner_originated",
    labelKey: "consult.partnerMode.partnerOriginated",
  },
];

const PARTNER_SERVICE_OPTIONS = [
  { value: "medical_agency", labelKey: "consult.partnerService.medicalAgency" },
  { value: "personal_agent", labelKey: "consult.partnerService.personalAgent" },
  { value: "interpreter", labelKey: "consult.partnerService.interpreter" },
  { value: "travel_agency", labelKey: "consult.partnerService.travelAgency" },
  { value: "airport_pickup", labelKey: "consult.partnerService.airportPickup" },
  { value: "hotel_recovery", labelKey: "consult.partnerService.hotelRecovery" },
];

const CONSULTATION_STEPS = [
  {
    title: "Contact",
    heading: "Patient contact",
    copy: "Tell GCL who should receive the coordinator follow-up.",
  },
  {
    title: "Care request",
    heading: "Treatment and provider request",
    copy: "Choose the package, market, treatment area, hospital preference, and budget.",
  },
  {
    title: "Travel",
    heading: "Schedule and eligibility",
    copy: "Add your preferred visit dates and any Korea eligibility details.",
  },
  {
    title: "Support",
    heading: "Partner support and consent",
    copy: "Choose whether non-medical partner support is needed before submitting.",
  },
] as const;

const STEP_FIELDS: Array<Array<keyof FormData>> = [
  ["name", "email", "residenceCountry"],
  [
    "packageInterest",
    "market",
    "treatmentInterest",
    "hospitalSlug",
    "budget",
    "message",
  ],
  [
    "preferredDate",
    "travelStartDate",
    "travelEndDate",
    "hasKoreanNationalHealthInsurance",
    "hasKoreanAlienRegistration",
    "hasOverseasKoreanResidenceReport",
  ],
  [
    "partnerAssistanceMode",
    "partnerServices",
    "partnerShareConsent",
    "preferredLanguage",
    "consent",
    "consentMarketing",
  ],
];

export default function Consultation() {
  const { t, lang } = useI18n();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const preselectedHospital = params.get("hospital") ?? "";
  const preselectedTreatment = params.get("treatment") ?? "";
  const preselectedPackage = params.get("package") ?? "";
  const preselectedMarket = params.get("market") ?? "";
  const sourceLanding = params.get("source_landing") ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<InquiryResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const resolvedHospital = useMemo(() => {
    return SAMPLE_HOSPITALS.find(
      hospital =>
        hospital.slug === preselectedHospital ||
        String(hospital.id) === preselectedHospital
    );
  }, [preselectedHospital]);
  const resolvedPackage = useMemo(
    () => getSkinPackageById(preselectedPackage),
    [preselectedPackage]
  );

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      preferredLanguage: lang,
      hospitalSlug: resolvedHospital?.slug ?? "",
      treatmentInterest: preselectedTreatment || resolvedPackage?.treatmentSlug,
      packageInterest: resolvedPackage?.id ?? preselectedPackage,
      market:
        preselectedMarket ||
        (resolvedPackage?.market === "taiwan" ? "taiwan" : "japan"),
      partnerAssistanceMode: "platform_direct",
      partnerServices: [],
      partnerShareConsent: false,
      consent: true,
    },
  });

  const preferredLanguage = watch("preferredLanguage");
  const selectedPackageId = watch("packageInterest");
  const selectedHospitalSlug = watch("hospitalSlug");
  const selectedBudget = watch("budget");
  const partnerAssistanceMode = watch("partnerAssistanceMode");
  const selectedPartnerServices = watch("partnerServices") ?? [];
  const selectedPackage = useMemo(
    () => getSkinPackageById(selectedPackageId ?? ""),
    [selectedPackageId]
  );
  const selectedHospital = useMemo(
    () =>
      SAMPLE_HOSPITALS.find(hospital => hospital.slug === selectedHospitalSlug),
    [selectedHospitalSlug]
  );
  const partnerSupportRequested =
    partnerAssistanceMode !== "platform_direct" ||
    selectedPartnerServices.length > 0;
  const hasFormErrors = Object.keys(errors).length > 0;
  const currentStep = CONSULTATION_STEPS[stepIndex];
  const isLastStep = stepIndex === CONSULTATION_STEPS.length - 1;
  const today = new Date().toISOString().split("T")[0];

  const onInvalid = () => {
    toast.error(t("consult.requiredCheck"));
    window.setTimeout(() => {
      document
        .querySelector('[data-field-error="true"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  async function goNext() {
    const valid = await trigger(STEP_FIELDS[stepIndex]);
    if (!valid) {
      onInvalid();
      return;
    }
    setStepIndex(current =>
      Math.min(current + 1, CONSULTATION_STEPS.length - 1)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const selectedBudgetRange = BUDGETS.find(
        budget => budget.label === data.budget
      );
      const result = await submitInquiry({
        name: data.name,
        email: data.email,
        phone: data.phone,
        nationality: data.nationality,
        residenceCountry: data.residenceCountry,
        preferredLanguage: data.preferredLanguage,
        treatmentInterest: data.treatmentInterest,
        packageInterest: data.packageInterest,
        market: data.market,
        hospitalSlug: data.hospitalSlug,
        preferredDate: data.preferredDate,
        travelStartDate: data.travelStartDate,
        travelEndDate: data.travelEndDate,
        budget: data.budget,
        budgetMin: selectedBudgetRange?.min,
        budgetMax: selectedBudgetRange?.max,
        currency: "USD",
        message: data.message,
        partnerAssistanceMode: data.partnerAssistanceMode,
        partnerServices: data.partnerServices,
        partnerShareConsent: data.partnerShareConsent,
        hasKoreanNationalHealthInsurance: data.hasKoreanNationalHealthInsurance,
        hasKoreanAlienRegistration: data.hasKoreanAlienRegistration,
        hasOverseasKoreanResidenceReport: data.hasOverseasKoreanResidenceReport,
        sourceLanding,
        consent: data.consent,
        consentMarketing: data.consentMarketing,
      });
      setDemoMode(result.demoMode);
      setSubmitResult(result);
      setSubmitted(true);
      toast.success(
        result.demoMode
          ? t("consult.localSaved")
          : result.storage === "v1"
            ? t("consult.v1Saved")
            : t("consult.success")
      );
    } catch (error) {
      console.error(error);
      toast.error(t("consult.failedSave"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <section className="grid min-h-[70vh] place-items-center bg-ink-50 px-4 py-20">
          <div className="max-w-lg rounded-lg border border-ink-200 bg-white p-8 text-center">
            <div className="mx-auto mb-5 grid size-16 place-items-center rounded-md bg-teal-50 text-teal-700">
              <CheckCircle2 className="size-9" />
            </div>
            <h1 className="font-serif text-4xl text-ink-950">
              {t("consult.savedTitle")}
            </h1>
            <p className="mt-4 leading-7 text-ink-600">
              {submitResult?.eligible === false
                ? t("consult.savedEligibilityReview")
                : t("consult.savedReview")}
            </p>
            <div className="mt-5 grid gap-3 text-left">
              {[
                ["1", t("consult.next.1")],
                ["2", t("consult.next.2")],
                ["3", t("consult.next.3")],
                ["4", t("consult.next.4")],
              ].map(([step, text]) => (
                <div
                  key={step}
                  className="flex gap-3 rounded-md border border-ink-200 bg-ink-50 p-3 text-sm text-ink-700"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded bg-teal-700 text-xs font-bold text-white">
                    {step}
                  </span>
                  {text}
                </div>
              ))}
            </div>
            {submitResult?.storage && (
              <p className="mt-4 rounded-md bg-teal-50 p-3 text-sm text-teal-800">
                {t("consult.storagePath")} {submitResult.storage}
                {submitResult.caseId
                  ? ` / Case ${submitResult.caseId.slice(0, 8)}`
                  : ""}
              </p>
            )}
            {demoMode && (
              <p className="mt-4 rounded-md bg-coral-50 p-3 text-sm text-coral-800">
                {t("consult.demoStorage")}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                className="border-ink-300"
                onClick={() => {
                  setSubmitted(false);
                  setStepIndex(0);
                }}
              >
                {t("consult.submitAnother")}
              </Button>
              <a href="/">
                <Button className="bg-teal-700 text-white hover:bg-teal-800">
                  {t("consult.backHome")}
                </Button>
              </a>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="border-b border-ink-200 bg-ink-950 py-14 text-white">
        <div className="container-wide">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-teal-100">
            GCL intake
          </div>
          <h1 className="font-serif text-5xl">{t("consult.title")}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-300">
            {t("consult.subtitle")}
          </p>
        </div>
      </section>

      <section className="bg-ink-50 py-10">
        <div className="container-wide grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-ink-200 bg-white p-6">
            <div className="mb-6 grid gap-2 sm:grid-cols-4">
              {CONSULTATION_STEPS.map((step, index) => {
                const active = index === stepIndex;
                const complete = index < stepIndex;
                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => {
                      if (index <= stepIndex) setStepIndex(index);
                    }}
                    disabled={index > stepIndex}
                    className={cn(
                      "rounded-md border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      active && "border-teal-700 bg-teal-50",
                      complete && "border-teal-200 bg-white",
                      !active && !complete && "border-ink-200 bg-ink-50"
                    )}
                  >
                    <div className="text-xs font-bold text-ink-500">
                      0{index + 1}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink-950">
                      {step.title}
                    </div>
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={handleSubmit(onSubmit, onInvalid)}
              className="grid gap-7"
            >
              <div className="border-b border-ink-100 pb-5">
                <h2 className="font-serif text-3xl text-ink-950">
                  {currentStep.heading}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  {currentStep.copy}
                </p>
              </div>

              {stepIndex === 0 && (
                <div className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={`${t("consult.name")} *`}
                      error={errors.name?.message}
                    >
                      <Input
                        {...register("name", {
                          required: t("consult.nameRequired"),
                        })}
                        placeholder="Jane Smith"
                        className={cn(
                          "h-11",
                          errors.name && "border-destructive"
                        )}
                      />
                    </Field>
                    <Field
                      label={`${t("consult.email")} *`}
                      error={errors.email?.message}
                    >
                      <Input
                        type="email"
                        {...register("email", {
                          required: t("consult.emailRequired"),
                        })}
                        placeholder="jane@example.com"
                        className={cn(
                          "h-11",
                          errors.email && "border-destructive"
                        )}
                      />
                    </Field>
                    <Field label={t("consult.phone")}>
                      <Input
                        {...register("phone")}
                        placeholder="+1 555 0100"
                        className="h-11"
                      />
                    </Field>
                    <Field label={t("consult.nationality")}>
                      <Input
                        {...register("nationality")}
                        placeholder="United States"
                        className="h-11"
                      />
                    </Field>
                    <Field
                      label={`${t("consult.residenceCountry")} *`}
                      error={errors.residenceCountry?.message}
                    >
                      <Input
                        {...register("residenceCountry", {
                          required: t("consult.residenceRequired"),
                        })}
                        placeholder="Japan"
                        className={cn(
                          "h-11",
                          errors.residenceCountry && "border-destructive"
                        )}
                      />
                    </Field>
                  </div>

                  <div>
                    <Label className="mb-3 block text-sm font-semibold text-ink-800">
                      {t("consult.language")}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map(language => (
                        <button
                          key={language.code}
                          type="button"
                          onClick={() =>
                            setValue("preferredLanguage", language.code)
                          }
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm font-semibold",
                            preferredLanguage === language.code
                              ? "border-teal-700 bg-teal-700 text-white"
                              : "border-ink-200 bg-white text-ink-600"
                          )}
                        >
                          {language.nativeLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {stepIndex === 1 && (
                <div className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("consult.packageWedge")}>
                      <select
                        {...register("packageInterest")}
                        className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        <option value="">{t("consult.selectPackage")}</option>
                        {SKIN_PACKAGE_SKUS.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.id} / {pkg.shortTitle}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("consult.targetMarket")}>
                      <select
                        {...register("market")}
                        className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        {MARKET_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("consult.treatment")}>
                      <select
                        {...register("treatmentInterest")}
                        className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        <option value="">{t("consult.selectTreatment")}</option>
                        {SAMPLE_TREATMENTS.map(treatment => (
                          <option key={treatment.slug} value={treatment.slug}>
                            {getLocalizedTreatmentName(treatment, lang)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("consult.preferredHospital")}>
                      <select
                        {...register("hospitalSlug")}
                        className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        <option value="">{t("consult.noPreference")}</option>
                        {SAMPLE_HOSPITALS.map(hospital => (
                          <option key={hospital.slug} value={hospital.slug}>
                            {getLocalizedHospitalName(hospital, lang)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("consult.budget")}>
                      <select
                        {...register("budget")}
                        className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        <option value="">{t("consult.selectBudget")}</option>
                        {BUDGETS.map(budget => (
                          <option key={budget.label} value={budget.label}>
                            {budget.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  {selectedPackage && (
                    <div className="rounded-md border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
                      {t("consult.selectedPackagePrefix")}{" "}
                      <span className="font-semibold">
                        {selectedPackage.title}
                      </span>{" "}
                      - {selectedPackage.recoveryWindow}{" "}
                      {t("consult.selectedPackageSuffix")}
                    </div>
                  )}

                  <Field label={t("consult.message")}>
                    <Textarea
                      {...register("message")}
                      rows={5}
                      placeholder={t("consult.messagePlaceholder")}
                      className="resize-none"
                    />
                  </Field>
                </div>
              )}

              {stepIndex === 2 && (
                <div className="grid gap-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label={t("consult.date")}>
                      <Input
                        type="date"
                        {...register("preferredDate")}
                        className="h-11"
                        min={today}
                      />
                    </Field>
                    <Field label={t("consult.travelStart")}>
                      <Input
                        type="date"
                        {...register("travelStartDate")}
                        className="h-11"
                        min={today}
                      />
                    </Field>
                    <Field label={t("consult.travelEnd")}>
                      <Input
                        type="date"
                        {...register("travelEndDate")}
                        className="h-11"
                        min={today}
                      />
                    </Field>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-ink-800">
                      {t("consult.eligibilityTitle")}
                    </h3>
                    <div className="grid gap-3">
                      {[
                        [
                          "hasKoreanNationalHealthInsurance",
                          t("consult.eligibility.nhi"),
                        ],
                        [
                          "hasKoreanAlienRegistration",
                          t("consult.eligibility.alien"),
                        ],
                        [
                          "hasOverseasKoreanResidenceReport",
                          t("consult.eligibility.overseas"),
                        ],
                      ].map(([name, label]) => (
                        <label
                          key={name}
                          className="flex gap-3 rounded-md border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700"
                        >
                          <input
                            type="checkbox"
                            {...register(name as keyof FormData)}
                            className="mt-1 size-4 rounded border-ink-300 accent-coral-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-ink-500">
                      {t("consult.eligibilityHelp")}
                    </p>
                  </div>
                </div>
              )}

              {stepIndex === 3 && (
                <div className="grid gap-6">
                  <div className="grid gap-4">
                    <Field label={t("consult.partnerSupportMode")}>
                      <select
                        {...register("partnerAssistanceMode")}
                        className="h-11 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      >
                        {PARTNER_ASSISTANCE_MODES.map(mode => (
                          <option key={mode.value} value={mode.value}>
                            {t(mode.labelKey)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div>
                      <Label className="mb-3 block text-sm font-semibold text-ink-800">
                        {t("consult.partnerServices")}
                      </Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {PARTNER_SERVICE_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className="flex gap-3 rounded-md border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700"
                          >
                            <input
                              type="checkbox"
                              value={option.value}
                              {...register("partnerServices")}
                              className="mt-1 size-4 rounded border-ink-300 accent-teal-700"
                            />
                            {t(option.labelKey)}
                          </label>
                        ))}
                      </div>
                    </div>

                    {partnerSupportRequested && (
                      <label className="flex gap-3 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
                        <input
                          type="checkbox"
                          {...register("partnerShareConsent")}
                          className="mt-1 size-4 rounded border-teal-300 accent-teal-700"
                        />
                        {t("consult.partnerShareConsent")}
                      </label>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <label className="flex gap-3 rounded-md border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        {...register("consent", { required: true })}
                        className="mt-1 size-4 rounded border-ink-300 accent-teal-700"
                      />
                      {t("consult.consent")}
                    </label>
                    <label className="flex gap-3 rounded-md border border-ink-200 bg-white p-4 text-sm text-ink-700">
                      <input
                        type="checkbox"
                        {...register("consentMarketing")}
                        className="mt-1 size-4 rounded border-ink-300 accent-teal-700"
                      />
                      {t("consult.marketingConsent")}
                    </label>
                  </div>
                </div>
              )}

              {hasFormErrors && (
                <div
                  role="alert"
                  className="rounded-md border border-coral-200 bg-coral-50 p-3 text-sm font-semibold text-coral-800"
                >
                  {t("consult.requiredCheck")}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={stepIndex === 0}
                  onClick={() =>
                    setStepIndex(current => Math.max(current - 1, 0))
                  }
                  className="border-ink-300 text-ink-800 disabled:opacity-50"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                {isLastStep ? (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800 disabled:bg-ink-300"
                  >
                    {isSubmitting ? t("consult.saving") : t("consult.submit")}
                    <ShieldCheck className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={goNext}
                    className="h-12 bg-teal-700 px-6 text-white hover:bg-teal-800"
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <h2 className="font-serif text-2xl text-ink-950">
                Request summary
              </h2>
              <div className="mt-4 grid gap-3 text-sm">
                <SummaryRow
                  label="Package"
                  value={
                    selectedPackage?.shortTitle ??
                    selectedPackageId ??
                    "Not selected"
                  }
                />
                <SummaryRow
                  label="Hospital"
                  value={
                    selectedHospital
                      ? getLocalizedHospitalName(selectedHospital, lang)
                      : t("consult.noPreference")
                  }
                />
                <SummaryRow
                  label="Budget"
                  value={selectedBudget || t("consult.selectBudget")}
                />
                <SummaryRow
                  label="Partner support"
                  value={
                    partnerSupportRequested ? "Requested" : "Platform direct"
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <h2 className="font-serif text-2xl text-ink-950">
                {t("consult.operationalStatus")}
              </h2>
              <div className="mt-4 grid gap-3">
                <StatusItem
                  icon={Database}
                  title={
                    isSupabaseConfigured()
                      ? t("consult.supabaseConnected")
                      : t("consult.demoStorageActive")
                  }
                  text={
                    isSupabaseConfigured()
                      ? t("consult.supabaseConnectedText")
                      : t("consult.demoStorageActiveText")
                  }
                />
                <StatusItem
                  icon={LockKeyhole}
                  title={t("consult.consentCaptured")}
                  text={t("consult.consentCapturedText")}
                />
                <StatusItem
                  icon={Clock}
                  title={t("consult.manualMatchingSla")}
                  text={t("consult.manualMatchingSlaText")}
                />
              </div>
            </div>

            <div className="rounded-lg border border-ink-200 bg-ink-950 p-5 text-white">
              <MessageCircle className="mb-4 size-6 text-teal-300" />
              <h2 className="font-serif text-2xl">{t("consult.whatNext")}</h2>
              <p className="mt-3 text-sm leading-6 text-ink-300">
                {t("consult.whatNextCopy")}
              </p>
            </div>

            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <Globe2 className="mb-4 size-6 text-teal-700" />
              <h2 className="font-serif text-2xl text-ink-950">
                {t("consult.globalRouting")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink-600">
                {t("consult.globalRoutingCopy")}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </Layout>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label
      className="grid gap-1.5"
      data-field-error={error ? "true" : undefined}
    >
      <span className="text-sm font-semibold text-ink-800">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-ink-500">{label}</span>
      <span className="max-w-[180px] text-right font-semibold text-ink-950">
        {value}
      </span>
    </div>
  );
}

function StatusItem({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-md bg-ink-50 p-3">
      <Icon className="mt-0.5 size-5 text-teal-700" />
      <div>
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <p className="mt-1 text-xs leading-5 text-ink-500">{text}</p>
      </div>
    </div>
  );
}
