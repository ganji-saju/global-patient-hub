import type {
  BetaCase,
  BetaPartner,
  BetaProviderCandidate,
} from "@/lib/betaData";
import type { LandingLocale, WedgeMarket } from "@/lib/landingRouteOptions";

export interface PartnerMvpSnapshot {
  cases: BetaCase[];
  partners: BetaPartner[];
  providers: BetaProviderCandidate[];
  providerQuoteRequests?: ProviderQuoteRequest[];
  quotes?: ProviderQuote[];
  availabilitySlots?: AvailabilitySlot[];
  bookings?: BookingReservation[];
  activities?: CaseActivityEvent[];
  landingRoutes?: ManagedLandingRoute[];
  packageSkus?: ManagedPackageSku[];
  contactChannels?: ContactChannelSetting[];
  providerOperatingProfiles?: ProviderOperatingProfile[];
  providerPublicProfiles?: ProviderPublicProfile[];
  providerPublicProfileI18n?: ProviderPublicProfileI18n[];
  providerPublicMedia?: ProviderPublicMedia[];
  providerPublicDoctors?: ProviderPublicDoctor[];
  providerPublicTreatments?: ProviderPublicTreatment[];
  meta?: {
    mode: "supabase";
    role?: OpsRole;
    scopedAccountId?: string | null;
    scopedAccountEnabled?: boolean;
    roleTokensConfigured?: {
      admin: boolean;
      partner: boolean;
      provider: boolean;
      partnerScoped: boolean;
      providerScoped: boolean;
    };
    emailAccessConfigured?: boolean;
    authMethod?: "email" | "legacy_token";
    authEmail?: string | null;
    leadStorageHealth?: {
      patients: number | null;
      leads: number | null;
      cases: number | null;
      medicalIntakes: number | null;
      latestLeadAt: string | null;
      v1PipelineReady: boolean;
      checkedAt: string;
    };
    adminPersistenceHealth?: {
      adminLandingRoutes: number | null;
      adminPackageSkus?: number | null;
      contactChannels: number | null;
      providerOperatingProfiles: number | null;
      providerDataQualityChecks: number | null;
      notificationOutbox: number | null;
      ready: boolean;
      checkedAt: string;
    };
    notificationDispatchConfigured?: boolean;
    notificationOutboxConfigured?: boolean;
    stripeConfigured?: boolean;
    paymentMode?: "test" | "live" | "not_configured";
    partnerServiceRequestTableReady?: boolean;
    quoteRequestTableReady?: boolean;
    partnerRequestCount: number;
    quoteRequestCount?: number;
    quoteResponseCount?: number;
    generatedAt: string;
    hasDbPartners: boolean;
    hasDbProviders: boolean;
  };
}

export type PartnerMvpActionSnapshot = PartnerMvpSnapshot;
export type OpsRole = "admin" | "partner" | "provider";
export type LandingRouteStatus = "draft" | "published" | "paused" | "archived";
export type ManagedPackageMarket = WedgeMarket | "both";

export interface LocalizedLandingRouteCopy {
  intent?: string;
  title?: string;
  subtitle?: string;
  searchTheme?: string;
  cta?: string;
  secondaryCta?: string;
}

export interface LocalizedPackageSkuCopy {
  shortTitle?: string;
  recoveryWindow?: string;
  bestFor?: string;
  includes?: string[];
  complianceNote?: string;
}

export interface ManagedLandingRoute {
  id?: string;
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
  status: LandingRouteStatus;
  source?: string;
  active?: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
  translations?: Record<string, LocalizedLandingRouteCopy>;
  translationSourceLocale?: string;
  translationProvider?: string | null;
  translatedAt?: string | null;
  autoTranslate?: boolean;
  targetLocales?: string[];
}

export interface ManagedPackageSku {
  id: string;
  shortTitle: string;
  market: ManagedPackageMarket;
  category: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  durationDays: number;
  recoveryWindow: string;
  coordinatorLanguages: string[];
  bestFor: string;
  includes: string[];
  complianceNote: string;
  source?: string;
  active?: boolean;
  updatedAt?: string;
  translations?: Record<string, LocalizedPackageSkuCopy>;
  translationSourceLocale?: string;
  translationProvider?: string | null;
  translatedAt?: string | null;
  autoTranslate?: boolean;
  targetLocales?: string[];
}

export interface ContactChannelSetting {
  channel: "whatsapp" | "line" | "wechat" | "kakao";
  label: string;
  href: string;
  officialAccountId?: string | null;
  officialVerified: boolean;
  active: boolean;
  displayOrder: number;
  notes?: string | null;
}

export interface ProviderOperatingProfile {
  providerId: string;
  publicExposureStatus: "blocked" | "candidate" | "ready" | "published";
  dataSourceStatus: "demo_seed" | "candidate" | "verified_docs" | "contracted";
  supportedMarkets: string[];
  supportedLanguages: string[];
  standardSlaHours: number;
  urgentSlaHours: number;
  priceRangeUsdMin?: number | null;
  priceRangeUsdMax?: number | null;
  quoteTemplateReady: boolean;
  depositPolicyReady: boolean;
  slaContractStatus:
    | "draft"
    | "sent"
    | "negotiating"
    | "pending_docs"
    | "signed";
  verificationSummary?: string | null;
  sourceNotes?: string | null;
  lastVerifiedAt?: string | null;
  nextStep?: string | null;
}

export type ProviderPublicStatus =
  | "draft"
  | "review_requested"
  | "ready"
  | "published"
  | "paused";

export interface ProviderPublicProfile {
  providerId: string;
  slug: string;
  status: ProviderPublicStatus;
  specialty?: string | null;
  region?: string | null;
  phonePublic?: string | null;
  websiteUrl?: string | null;
  priceTier?: "$" | "$$" | "$$$" | null;
  rating?: number | null;
  reviewCount: number;
  latitude?: number | null;
  longitude?: number | null;
  featured: boolean;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

export interface ProviderPublicProfileI18n {
  id?: string;
  providerId?: string;
  locale: "ko" | "en" | "ja" | "zh" | "th" | "vi" | "ar" | "ru";
  name: string;
  summary?: string | null;
  description?: string | null;
  address?: string | null;
  specialties: string[];
  highlights: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface ProviderPublicMedia {
  id?: string;
  providerId?: string;
  mediaType: "cover" | "gallery" | "doctor";
  storagePath?: string | null;
  publicUrl?: string | null;
  altText?: string | null;
  displayOrder: number;
  active: boolean;
}

export interface ProviderPublicDoctor {
  id?: string;
  providerId?: string;
  name: string;
  title?: string | null;
  specialty?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  yearsExperience?: number | null;
  displayOrder: number;
  active: boolean;
}

export interface ProviderPublicTreatment {
  id?: string;
  providerId?: string;
  treatmentSlug?: string | null;
  title: string;
  priceMinKrw?: number | null;
  priceMaxKrw?: number | null;
  recoveryDays?: number | null;
  durationMinutes?: number | null;
  notes?: string | null;
  active: boolean;
}

export interface ProviderPublicProfileInput extends Omit<
  ProviderPublicProfile,
  "providerId" | "publishedAt" | "updatedAt" | "reviewCount" | "featured"
> {
  reviewCount?: number;
  featured?: boolean;
  i18n: ProviderPublicProfileI18n[];
  media: ProviderPublicMedia[];
  doctors: ProviderPublicDoctor[];
  treatments: ProviderPublicTreatment[];
}

export interface ProviderQuote {
  id: string;
  quoteRequestId?: string;
  caseId: string;
  providerId: string;
  medicalFeeUsd: number;
  nonmedicalFeeUsd: number;
  commissionRate: number;
  capRate: number;
  depositAmountUsd: number;
  currency: string;
  validUntil: string;
  status: string;
  sentAt?: string;
  notes: string;
  createdAt: string;
}

export interface ProviderQuoteRequest {
  id: string;
  caseId: string;
  providerId: string;
  providerName: string;
  patientAlias: string;
  procedure: string;
  market: string;
  language: string;
  budgetMinUsd: number;
  budgetMaxUsd: number;
  travelStart: string;
  travelEnd: string;
  status: string;
  dueAt?: string;
  requestedAt: string;
  notes: string;
  caseStatus: string;
  quote: ProviderQuote | null;
}

export type SlotStatus = "available" | "held" | "booked" | "unavailable";
export type VisitType = "consultation" | "procedure" | "surgery" | "checkup";

export interface AvailabilitySlot {
  id: string;
  providerId: string;
  doctorId?: string | null;
  procedureId?: string | null;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  languageSupport: string[];
  holdExpiresAt?: string | null;
  holdCaseId?: string | null;
  holdQuoteId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingReservation {
  id: string;
  caseId: string;
  quoteId: string;
  providerId: string;
  scheduledAt: string;
  visitType: VisitType;
  status:
    | "requested"
    | "confirmed"
    | "rescheduled"
    | "completed"
    | "cancelled"
    | "no_show";
  confirmedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CaseActivityEvent {
  id: string;
  caseId: string;
  actorRole: string;
  actorLabel?: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  createdAt: string;
}

export interface ProviderQuoteInput {
  quoteRequestId: string;
  caseId: string;
  providerId: string;
  medicalFee: number;
  nonmedicalFee: number;
  currency: string;
  commissionRate: number;
  depositAmount: number;
  validUntil: string;
  notes: string;
}

export interface NotificationInput {
  caseId: string;
  quoteId?: string;
  bookingId?: string;
  channel: "email" | "whatsapp" | "kakao" | "line" | "sms";
  recipient?: string;
  template: string;
  sendAfter?: string;
  deliveryKey?: string;
  payload?: Record<string, unknown>;
}

export interface NotificationResult {
  ok: boolean;
  notificationId: string;
  status: "queued" | "sent" | "failed";
  storage: string;
  dispatchResult?: Record<string, unknown>;
}

export interface DepositCheckoutInput {
  caseId: string;
  quoteId: string;
  providerId?: string;
  depositAmountUsd: number;
}

export interface DepositCheckoutResult {
  ok: boolean;
  checkoutUrl: string;
  sessionId: string;
  paymentMode: "test" | "live" | "not_configured";
}

export interface AvailabilitySlotInput {
  providerId: string;
  startsAt: string;
  endsAt: string;
  languageSupport?: string[];
  status?: SlotStatus;
}

export interface AdminProviderInput {
  nameLegal: string;
  nameDisplayKo: string;
  nameDisplayEn?: string;
  opsEmail?: string;
  facilityType:
    | "clinic"
    | "hospital"
    | "general_hospital"
    | "tertiary_hospital";
  address: string;
  city: string;
  district?: string;
  countryCode: string;
  medicalKoreaRegistered: boolean;
  active: boolean;
  defaultCommissionCapRate: number;
  qualityScore: number;
  publicExposureStatus: "blocked" | "candidate" | "ready" | "published";
  dataSourceStatus: "demo_seed" | "candidate" | "verified_docs" | "contracted";
  supportedMarkets: string[];
  supportedLanguages: string[];
  standardSlaHours: number;
  urgentSlaHours: number;
  priceRangeUsdMin?: number | null;
  priceRangeUsdMax?: number | null;
  quoteTemplateReady: boolean;
  depositPolicyReady: boolean;
  slaContractStatus:
    | "draft"
    | "sent"
    | "negotiating"
    | "pending_docs"
    | "signed";
  verificationSummary?: string;
  sourceNotes?: string;
  nextStep?: string;
  publicProfile?: ProviderPublicProfileInput;
}

export interface AdminPartnerInput {
  name: string;
  partnerType: BetaPartner["type"];
  contactEmail?: string;
  contactPhone?: string;
  opsEmail?: string;
  defaultRevenueShareRate: number;
  active: boolean;
  services: string[];
  preferredProviderIds: string[];
  notes?: string;
}

export interface HoldAvailabilitySlotInput {
  slotId: string;
  caseId: string;
  quoteId?: string;
  holdMinutes?: number;
  channel?: NotificationInput["channel"];
  recipient?: string;
}

export interface ReleaseAvailabilitySlotInput {
  slotId: string;
  caseId?: string;
  quoteId?: string;
}

export interface ConfirmHeldBookingInput {
  slotId: string;
  caseId: string;
  quoteId: string;
  visitType: VisitType;
  channel?: NotificationInput["channel"];
  recipient?: string;
}

export interface ReservationActionResult {
  ok: boolean;
  slot?: AvailabilitySlot;
  booking?: BookingReservation;
  notifications?: NotificationResult[];
}

const OPS_ACCESS_TOKEN_KEY = "gcl_ops_access_token:v1";
const OPS_EMAIL_KEY = "gcl_ops_email:v1";
const OPS_ROLE_KEY = "gcl_ops_role";
const LEGACY_ADMIN_TOKEN_KEY = "gcl_admin_api_token";
const ADMIN_API_TIMEOUT_MS = 15000;
const PARTNER_MVP_SNAPSHOT_CACHE_TTL_MS = 30000;
export const OPS_SESSION_CHANGED_EVENT = "gcl:ops-session-changed";

interface PartnerMvpSnapshotCache {
  token: string;
  snapshot: PartnerMvpSnapshot;
  cachedAt: number;
}

let partnerMvpSnapshotCache: PartnerMvpSnapshotCache | null = null;
let partnerMvpSnapshotRequest: {
  token: string;
  promise: Promise<PartnerMvpSnapshot>;
} | null = null;

function notifyOpsSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPS_SESSION_CHANGED_EVENT));
}

export function normalizeOpsRole(value: string | null | undefined): OpsRole {
  return value === "partner" || value === "provider" ? value : "admin";
}

export function opsRoleLabel(role: OpsRole) {
  if (role === "partner") return "파트너";
  if (role === "provider") return "병원";
  return "관리자";
}

export function readOpsRole() {
  if (typeof window === "undefined") return "admin" as OpsRole;
  return normalizeOpsRole(localStorage.getItem(OPS_ROLE_KEY));
}

export function readOpsEmail() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(OPS_EMAIL_KEY) ?? "";
}

export function readAdminApiToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem(OPS_ACCESS_TOKEN_KEY) ??
    localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY) ??
    ""
  );
}

export function saveOpsSession(
  token: string,
  role: OpsRole,
  email?: string | null
) {
  if (typeof window === "undefined") return;
  if (token.trim()) localStorage.setItem(OPS_ACCESS_TOKEN_KEY, token.trim());
  else localStorage.removeItem(OPS_ACCESS_TOKEN_KEY);
  localStorage.setItem(OPS_ROLE_KEY, role);
  if (email?.trim())
    localStorage.setItem(OPS_EMAIL_KEY, email.trim().toLowerCase());
  else if (email === null) localStorage.removeItem(OPS_EMAIL_KEY);
  localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  notifyOpsSessionChanged();
}

export function saveAdminApiToken(token: string) {
  saveOpsSession(token, readOpsRole(), readOpsEmail() || undefined);
}

export function clearAdminApiToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OPS_ACCESS_TOKEN_KEY);
  localStorage.removeItem(OPS_EMAIL_KEY);
  localStorage.removeItem(OPS_ROLE_KEY);
  localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
  invalidatePartnerMvpSnapshotCache();
  notifyOpsSessionChanged();
}

function cacheMatches(
  token: string,
  maxAgeMs = PARTNER_MVP_SNAPSHOT_CACHE_TTL_MS
) {
  if (!partnerMvpSnapshotCache || partnerMvpSnapshotCache.token !== token)
    return false;
  return Date.now() - partnerMvpSnapshotCache.cachedAt <= maxAgeMs;
}

export function getCachedPartnerMvpSnapshot(
  token: string,
  maxAgeMs = PARTNER_MVP_SNAPSHOT_CACHE_TTL_MS
) {
  return cacheMatches(token, maxAgeMs)
    ? (partnerMvpSnapshotCache?.snapshot ?? null)
    : null;
}

export function setPartnerMvpSnapshotCache(
  token: string,
  snapshot: PartnerMvpSnapshot
) {
  partnerMvpSnapshotCache = { token, snapshot, cachedAt: Date.now() };
}

export function invalidatePartnerMvpSnapshotCache() {
  partnerMvpSnapshotCache = null;
  partnerMvpSnapshotRequest = null;
}

async function fetchAdminApi(init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_API_TIMEOUT_MS);

  try {
    return await fetch("/api/admin/partner-mvp", {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "관리자 API 응답 시간이 초과했습니다. 잠시 후 다시 시도하세요."
      );
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "관리자 API 응답 시간이 초과했습니다. 잠시 후 다시 시도하세요."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestPartnerMvpJson<T>(
  token: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetchAdminApi({
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error || `Partner MVP API failed with ${response.status}`
    );
  }

  return payload as T;
}

async function requestPartnerMvp(
  token: string,
  init?: RequestInit
): Promise<PartnerMvpSnapshot> {
  const payload = await requestPartnerMvpJson<PartnerMvpSnapshot>(token, init);
  if (
    !Array.isArray(payload.cases) ||
    !Array.isArray(payload.partners) ||
    !Array.isArray(payload.providers)
  ) {
    throw new Error("운영 API 응답 형식이 올바르지 않습니다.");
  }
  return payload;
}

export function fetchPartnerMvpSnapshot(
  token: string,
  options: { force?: boolean; maxAgeMs?: number } = {}
) {
  if (!options.force) {
    const cachedSnapshot = getCachedPartnerMvpSnapshot(token, options.maxAgeMs);
    if (cachedSnapshot) return Promise.resolve(cachedSnapshot);
    if (partnerMvpSnapshotRequest?.token === token)
      return partnerMvpSnapshotRequest.promise;
  }

  const promise = requestPartnerMvp(token)
    .then(snapshot => {
      setPartnerMvpSnapshotCache(token, snapshot);
      return snapshot;
    })
    .finally(() => {
      if (partnerMvpSnapshotRequest?.promise === promise)
        partnerMvpSnapshotRequest = null;
    });

  partnerMvpSnapshotRequest = { token, promise };
  return promise;
}

function requestPartnerMvpAction(token: string, init: RequestInit) {
  return requestPartnerMvp(token, init).then(snapshot => {
    setPartnerMvpSnapshotCache(token, snapshot);
    return snapshot;
  });
}

function invalidatePartnerMvpSnapshotAfter<T>(promise: Promise<T>) {
  return promise.then(payload => {
    invalidatePartnerMvpSnapshotCache();
    return payload;
  });
}

export function assignPartnerMvp(
  token: string,
  caseId: string,
  partnerId: string
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "assignPartner", caseId, partnerId }),
  });
}

export function advanceCaseStatusMvp(
  token: string,
  caseId: string,
  status: string
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "advanceCaseStatus", caseId, status }),
  });
}

export function setPartnerShortlistMvp(
  token: string,
  caseId: string,
  partnerId: string,
  providerIds: string[]
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({
      action: "setShortlist",
      caseId,
      partnerId,
      providerIds,
    }),
  });
}

export function requestPartnerQuoteMvp(
  token: string,
  caseId: string,
  partnerId: string,
  providerIds: string[]
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({
      action: "requestQuotes",
      caseId,
      partnerId,
      providerIds,
    }),
  });
}

export function submitProviderQuoteMvp(
  token: string,
  input: ProviderQuoteInput
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "submitProviderQuote", ...input }),
  });
}

export function upsertLandingRouteMvp(
  token: string,
  route: ManagedLandingRoute
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "upsertLandingRoute", route }),
  });
}

export function upsertPackageSkuMvp(
  token: string,
  packageSku: ManagedPackageSku
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "upsertPackageSku", packageSku }),
  });
}

export function deletePackageSkuMvp(token: string, packageId: string) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "deletePackageSku", packageId }),
  });
}

export function queueNotificationMvp(token: string, input: NotificationInput) {
  return invalidatePartnerMvpSnapshotAfter(
    requestPartnerMvpJson<NotificationResult>(token, {
      method: "POST",
      body: JSON.stringify({ action: "queueNotification", ...input }),
    })
  ).then(payload => {
    if (!payload?.notificationId || !payload.status) {
      throw new Error("알림 API 응답 형식이 올바르지 않습니다.");
    }
    return payload;
  });
}

export function createDepositCheckoutMvp(
  token: string,
  input: DepositCheckoutInput
) {
  return invalidatePartnerMvpSnapshotAfter(
    requestPartnerMvpJson<DepositCheckoutResult>(token, {
      method: "POST",
      body: JSON.stringify({ action: "createDepositCheckout", ...input }),
    })
  ).then(payload => {
    if (!payload?.checkoutUrl || !payload.sessionId) {
      throw new Error("예약금 결제 API 응답 형식이 올바르지 않습니다.");
    }
    return payload;
  });
}

export function createAvailabilitySlotMvp(
  token: string,
  input: AvailabilitySlotInput
) {
  return invalidatePartnerMvpSnapshotAfter(
    requestPartnerMvpJson<ReservationActionResult>(token, {
      method: "POST",
      body: JSON.stringify({ action: "createAvailabilitySlot", ...input }),
    })
  );
}

export function createProviderMvp(token: string, input: AdminProviderInput) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "createProvider", provider: input }),
  });
}

export function updateProviderMvp(
  token: string,
  providerId: string,
  input: AdminProviderInput
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({
      action: "updateProvider",
      providerId,
      provider: input,
    }),
  });
}

export function deleteProviderMvp(token: string, providerId: string) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "deleteProvider", providerId }),
  });
}

export function createPartnerMvp(token: string, input: AdminPartnerInput) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "createPartner", partner: input }),
  });
}

export function updatePartnerMvp(
  token: string,
  partnerId: string,
  input: AdminPartnerInput
) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({
      action: "updatePartner",
      partnerId,
      partner: input,
    }),
  });
}

export function deletePartnerMvp(token: string, partnerId: string) {
  return requestPartnerMvpAction(token, {
    method: "POST",
    body: JSON.stringify({ action: "deletePartner", partnerId }),
  });
}

export function holdAvailabilitySlotMvp(
  token: string,
  input: HoldAvailabilitySlotInput
) {
  return invalidatePartnerMvpSnapshotAfter(
    requestPartnerMvpJson<ReservationActionResult>(token, {
      method: "POST",
      body: JSON.stringify({ action: "holdAvailabilitySlot", ...input }),
    })
  );
}

export function releaseAvailabilitySlotMvp(
  token: string,
  input: ReleaseAvailabilitySlotInput
) {
  return invalidatePartnerMvpSnapshotAfter(
    requestPartnerMvpJson<ReservationActionResult>(token, {
      method: "POST",
      body: JSON.stringify({ action: "releaseAvailabilitySlot", ...input }),
    })
  );
}

export function confirmHeldBookingMvp(
  token: string,
  input: ConfirmHeldBookingInput
) {
  return invalidatePartnerMvpSnapshotAfter(
    requestPartnerMvpJson<ReservationActionResult>(token, {
      method: "POST",
      body: JSON.stringify({ action: "confirmHeldBooking", ...input }),
    })
  );
}
