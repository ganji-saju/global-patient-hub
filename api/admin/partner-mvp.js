const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const SUPABASE_TIMEOUT_MS = 10000;
const SUPABASE_AUTH_TIMEOUT_MS = 7000;
const ACTIVITY_LOG_TIMEOUT_MS = 3000;
const EXTERNAL_REQUEST_TIMEOUT_MS = 10000;

const CASE_STATUS_FALLBACK = {
  matched: "matching_ready",
  treated: "visited",
  aftercare: "visited",
  closed_won: "booking_confirmed",
};

const CASE_STATUSES = new Set([
  "new",
  "qualified",
  "intake_completed",
  "matching_ready",
  "matched",
  "quote_requested",
  "quote_sent",
  "deposit_pending",
  "deposit_paid",
  "booking_confirmed",
  "visited",
  "treated",
  "aftercare",
  "closed_won",
  "closed_lost",
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, payload) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function getHeader(req, name) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readToken(req) {
  const bearer = getHeader(req, "authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return bearer || getHeader(req, "x-admin-token")?.trim() || "";
}

function parseTokenMap(raw) {
  if (!raw) return new Map();

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Map(
        parsed
          .map(row => [
            String(row.token || "").trim(),
            String(
              row.accountId || row.partnerId || row.providerId || ""
            ).trim(),
          ])
          .filter(([token, accountId]) => token && accountId)
      );
    }

    if (parsed && typeof parsed === "object") {
      return new Map(
        Object.entries(parsed)
          .map(([token, accountId]) => [
            String(token).trim(),
            String(accountId || "").trim(),
          ])
          .filter(([token, accountId]) => token && accountId)
      );
    }
  } catch (error) {
    console.warn("Role token map could not be parsed.", error);
  }

  return new Map();
}

function readRoleTokenConfig() {
  const partnerMap = parseTokenMap(
    process.env.PARTNER_TOKEN_MAP || process.env.PARTNER_API_TOKEN_MAP
  );
  const providerMap = parseTokenMap(
    process.env.PROVIDER_TOKEN_MAP || process.env.PROVIDER_API_TOKEN_MAP
  );
  return {
    adminToken: process.env.ADMIN_API_TOKEN?.trim() || "",
    partnerToken: process.env.PARTNER_API_TOKEN?.trim() || "",
    providerToken: process.env.PROVIDER_API_TOKEN?.trim() || "",
    partnerMap,
    providerMap,
  };
}

async function verifySupabaseAuthUser(config, accessToken) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SUPABASE_AUTH_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401 || response.status === 403) return null;

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        body?.message ||
          body?.error_description ||
          text ||
          `Supabase Auth verification failed with ${response.status}`
      );
    }

    const user = body?.user || body;
    const email = String(user?.email || "")
      .trim()
      .toLowerCase();
    if (!user?.id || !email) return null;
    return { id: user.id, email };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Supabase Auth verification timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeAccessRole(value) {
  return value === "partner" || value === "provider"
    ? value
    : value === "admin"
      ? "admin"
      : "";
}

async function readEmailRoleAccess(config, email) {
  try {
    const rows = await supabaseFetch(
      config,
      `ops_user_access?select=id,email,role,partner_id,provider_id,active&email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`
    );
    return rows[0] || null;
  } catch (error) {
    if (String(error?.message || "").includes("ops_user_access")) {
      throw new HttpError(503, "ops_user_access migration is not applied.");
    }
    throw error;
  }
}

async function resolveRoleAccess(req, config) {
  const roleTokens = readRoleTokenConfig();
  const suppliedToken = readToken(req);

  if (!suppliedToken) {
    return { error: "Unauthorized.", status: 401 };
  }

  if (roleTokens.adminToken && suppliedToken === roleTokens.adminToken) {
    return {
      role: "admin",
      roleTokens,
      scopedAccountId: null,
      authMethod: "legacy_token",
      authEmail: null,
    };
  }

  if (roleTokens.partnerMap.has(suppliedToken)) {
    return {
      role: "partner",
      roleTokens,
      partnerId: roleTokens.partnerMap.get(suppliedToken),
      scopedAccountId: roleTokens.partnerMap.get(suppliedToken),
      authMethod: "legacy_token",
      authEmail: null,
    };
  }

  if (roleTokens.providerMap.has(suppliedToken)) {
    return {
      role: "provider",
      roleTokens,
      providerId: roleTokens.providerMap.get(suppliedToken),
      scopedAccountId: roleTokens.providerMap.get(suppliedToken),
      authMethod: "legacy_token",
      authEmail: null,
    };
  }

  if (roleTokens.partnerToken && suppliedToken === roleTokens.partnerToken) {
    return {
      role: "partner",
      roleTokens,
      scopedAccountId: null,
      authMethod: "legacy_token",
      authEmail: null,
    };
  }

  if (roleTokens.providerToken && suppliedToken === roleTokens.providerToken) {
    return {
      role: "provider",
      roleTokens,
      scopedAccountId: null,
      authMethod: "legacy_token",
      authEmail: null,
    };
  }

  const user = await verifySupabaseAuthUser(config, suppliedToken);
  if (!user) return { error: "Unauthorized.", status: 401 };

  const access = await readEmailRoleAccess(config, user.email);
  if (!access)
    return {
      error: "This email is not allowed for operations access.",
      status: 403,
    };

  const role = normalizeAccessRole(access.role);
  if (!role)
    return {
      error: "This email has an unsupported operations role.",
      status: 403,
    };
  if (role === "partner" && !access.partner_id)
    return {
      error: "Partner operations access requires a partner_id.",
      status: 403,
    };
  if (role === "provider" && !access.provider_id)
    return {
      error: "Provider operations access requires a provider_id.",
      status: 403,
    };

  return {
    role,
    roleTokens,
    partnerId: access.partner_id || undefined,
    providerId: access.provider_id || undefined,
    scopedAccountId: access.partner_id || access.provider_id || null,
    authMethod: "email",
    authEmail: user.email,
  };
}

async function requireConfig(req, allowedRoles = ["admin"]) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error: "Supabase server credentials are not configured.",
      status: 503,
    };
  }

  const baseConfig = {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
  };

  const access = await resolveRoleAccess(req, baseConfig);
  if (access.error) return access;

  if (access.role !== "admin" && !allowedRoles.includes(access.role)) {
    return {
      error: "This role is not allowed to perform this operation.",
      status: 403,
    };
  }

  return {
    ...baseConfig,
    role: access.role,
    partnerId: access.partnerId,
    providerId: access.providerId,
    scopedAccountId: access.scopedAccountId,
    roleTokens: access.roleTokens,
    authMethod: access.authMethod,
    authEmail: access.authEmail,
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function inFilter(values) {
  return `in.(${values.join(",")})`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function supabaseFetch(config, path, init = {}) {
  const {
    headers,
    prefer,
    timeoutMs = SUPABASE_TIMEOUT_MS,
    ...fetchInit
  } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
        ...(headers || {}),
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Supabase request timed out: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      body?.message ||
      body?.hint ||
      text ||
      `Supabase request failed with ${response.status}`;
    throw new Error(message);
  }

  return body;
}

async function supabaseCount(config, table) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/${table}?select=*`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
      }
    );

    if (!response.ok) return null;

    const contentRange = response.headers.get("content-range") || "";
    const total = Number(contentRange.split("/")[1]);
    return Number.isFinite(total) ? total : null;
  } catch (error) {
    console.warn(`Supabase count skipped for ${table}.`, error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getLeadStorageHealth(config) {
  const [patients, leads, cases, medicalIntakes, latestLeads] =
    await Promise.all([
      supabaseCount(config, "patients"),
      supabaseCount(config, "leads"),
      supabaseCount(config, "cases"),
      supabaseCount(config, "medical_intakes"),
      safeList(
        config,
        "leads",
        "select=created_at&order=created_at.desc&limit=1"
      ),
    ]);

  const latestLeadAt = latestLeads[0]?.created_at || null;
  const v1PipelineReady =
    patients !== null &&
    leads !== null &&
    cases !== null &&
    medicalIntakes !== null &&
    leads > 0 &&
    patients >= leads &&
    cases <= leads &&
    medicalIntakes <= cases;

  return {
    patients,
    leads,
    cases,
    medicalIntakes,
    latestLeadAt,
    v1PipelineReady,
    checkedAt: new Date().toISOString(),
  };
}

async function getAdminPersistenceHealth(config) {
  const [
    adminLandingRoutes,
    adminPackageSkus,
    contactChannels,
    providerOperatingProfiles,
    providerDataQualityChecks,
    notificationOutbox,
  ] = await Promise.all([
    supabaseCount(config, "admin_landing_routes"),
    supabaseCount(config, "admin_package_skus"),
    supabaseCount(config, "contact_channel_settings"),
    supabaseCount(config, "provider_operating_profiles"),
    supabaseCount(config, "provider_data_quality_checks"),
    supabaseCount(config, "notification_outbox"),
  ]);

  return {
    adminLandingRoutes,
    adminPackageSkus,
    contactChannels,
    providerOperatingProfiles,
    providerDataQualityChecks,
    notificationOutbox,
    ready:
      adminLandingRoutes !== null &&
      adminPackageSkus !== null &&
      contactChannels !== null &&
      providerOperatingProfiles !== null &&
      providerDataQualityChecks !== null &&
      notificationOutbox !== null,
    checkedAt: new Date().toISOString(),
  };
}

async function list(config, table, query) {
  return supabaseFetch(config, `${table}?${query}`);
}

async function safeList(config, table, query) {
  try {
    return await list(config, table, query);
  } catch (error) {
    console.warn(`Optional Supabase list skipped for ${table}.`, error);
    return [];
  }
}

async function logActivity(
  config,
  {
    caseId,
    actorRole = "admin",
    actorLabel = "Operations",
    eventType,
    eventPayload = {},
  }
) {
  if (!caseId || !eventType) return;
  try {
    await supabaseFetch(config, "case_activity_events", {
      method: "POST",
      body: JSON.stringify({
        case_id: caseId,
        actor_role: actorRole,
        actor_label: actorLabel,
        event_type: eventType,
        event_payload: eventPayload,
      }),
      prefer: "return=minimal",
      timeoutMs: ACTIVITY_LOG_TIMEOUT_MS,
    });
  } catch (error) {
    console.warn("Optional case activity insert skipped.", error);
  }
}

function displayName(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return (
    value.en || value.ko || value.ja || Object.values(value)[0] || fallback
  );
}

function normalizeStatus(status) {
  return CASE_STATUS_FALLBACK[status] || status || "qualified";
}

function marketFromLead(lead) {
  const attribution = lead?.attribution || {};
  return (
    attribution.market ||
    lead?.residence_country ||
    lead?.nationality ||
    "global"
  )
    .toString()
    .toLowerCase();
}

function localeFromLead(lead) {
  const language = (lead?.preferred_language || "en").toLowerCase();
  return language.startsWith("ja") ? "jp" : "en";
}

function nextActionFor(row) {
  if (row.quoteRequestedProviderIds.length) return "Provider quote SLA check";
  if (row.partnerShortlistedProviderIds.length)
    return "Coordinator to request quotes from partner shortlist";
  if (row.assignedPartnerId) return "Partner should select provider candidates";
  if (row.partnerAssistanceMode !== "platform_direct")
    return "Assign partner for requested services";
  return "Continue coordinator qualification";
}

function normalizeCase({
  request,
  lead,
  caseRow,
  intake,
  assignment,
  shortlists,
  quoteRequests,
}) {
  const riskFlags = intake?.risk_flags || {};
  const requestedServices =
    request?.requested_services || riskFlags.partner_services || [];
  const shortlisted = shortlists
    .filter(
      row =>
        row.selection_status !== "excluded" &&
        row.selection_status !== "rejected"
    )
    .map(row => row.provider_id);
  const quoteRequested = Array.from(
    new Set([
      ...shortlists
        .filter(row => row.selection_status === "quote_requested")
        .map(row => row.provider_id),
      ...quoteRequests.map(row => row.provider_id),
    ])
  );
  const partnerAssistanceMode =
    request?.assistance_mode ||
    riskFlags.partner_assistance_mode ||
    "platform_direct";
  const currency = lead?.currency || intake?.currency || "USD";
  const row = {
    id: caseRow?.id || request?.case_id || request?.id,
    leadId: lead?.id || request?.lead_id || "",
    patientAlias:
      lead?.name ||
      `Case ${(caseRow?.id || request?.case_id || request?.id || "").slice(0, 8)}`,
    owner: "Coordinator",
    status: normalizeStatus(caseRow?.status),
    priority: caseRow?.priority || "normal",
    locale: localeFromLead(lead),
    market: marketFromLead(lead),
    source: lead?.source || caseRow?.source || "site",
    campaign:
      lead?.attribution?.campaign ||
      lead?.attribution?.utm_campaign ||
      "direct",
    landingPath:
      lead?.attribution?.source_landing ||
      lead?.attribution?.current_path ||
      "/consultation",
    packageId:
      lead?.attribution?.package_interest ||
      riskFlags.package_interest ||
      "custom-request",
    procedure:
      lead?.treatment_interest ||
      lead?.attribution?.package_interest ||
      "Consultation request",
    language: lead?.preferred_language || "en",
    budgetMinUsd: Number(lead?.budget_min || intake?.budget_min || 0),
    budgetMaxUsd: Number(lead?.budget_max || intake?.budget_max || 0),
    travelStart:
      intake?.travel_start_date ||
      request?.request_snapshot?.travel_start_date ||
      "TBD",
    travelEnd:
      intake?.travel_end_date ||
      request?.request_snapshot?.travel_end_date ||
      "TBD",
    matchedProviderId: quoteRequested[0] || shortlisted[0],
    partnerAssistanceMode,
    requestedPartnerServices: requestedServices,
    partnerShareConsent: Boolean(
      request?.consent_to_share_with_partners || riskFlags.partner_share_consent
    ),
    assignedPartnerId: assignment?.partner_id,
    partnerShortlistedProviderIds: shortlisted,
    quoteRequestedProviderIds: quoteRequested,
    firstResponseMinutes: 0,
    nextAction: "",
    nextActionAt:
      caseRow?.updated_at || request?.created_at || new Date().toISOString(),
    riskFlags:
      request?.consent_to_share_with_partners === false
        ? ["partner consent needed"]
        : [],
    currency,
  };

  row.nextAction = nextActionFor(row);
  return row;
}

function normalizePartner(row) {
  const seededProfiles = {
    "Tokyo Care Bridge": {
      languages: ["ja", "en", "ko"],
      markets: ["japan"],
      services: ["medical_agency", "personal_agent", "interpreter"],
      slaHours: 4,
      verificationStatus: "verified",
    },
    "Taipei Wellness Travel": {
      languages: ["zh", "en", "ko"],
      markets: ["taiwan"],
      services: ["travel_agency", "airport_pickup", "hotel_recovery"],
      slaHours: 6,
      verificationStatus: "verified",
    },
    "Seoul Med Interpreter Pool": {
      languages: ["ja", "zh", "en", "ko"],
      markets: ["japan", "taiwan"],
      services: ["interpreter", "concierge"],
      slaHours: 8,
      verificationStatus: "pending",
    },
  };
  const profile = seededProfiles[row.name] || {};
  return {
    id: row.id,
    name: row.name,
    type: row.partner_type || "agency",
    verificationStatus:
      profile.verificationStatus || row.verification_status || "pending",
    languages: profile.languages || row.languages || ["en", "ko"],
    markets: profile.markets || row.markets || ["global"],
    services: profile.services || row.services || [],
    preferredProviderIds: row.preferred_provider_ids || [],
    active: Boolean(row.active),
    slaHours: profile.slaHours || row.sla_hours || 8,
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
    defaultRevenueShareRate: Number(row.default_revenue_share_rate || 0),
    opsEmail: row.ops_email || "",
  };
}

function normalizeProvider(row) {
  const profile = row.operating_profile || {};
  const nameDisplay = row.name_display || {};
  const standardSlaHours = Number(
    profile.standard_sla_hours ||
      Math.max(1, Math.ceil((row.average_response_minutes || 360) / 60))
  );
  return {
    id: row.id,
    name: displayName(nameDisplay, row.name_legal),
    nameLegal: row.name_legal || "",
    nameDisplayKo: nameDisplay.ko || displayName(nameDisplay, row.name_legal),
    nameDisplayEn: nameDisplay.en || displayName(nameDisplay, row.name_legal),
    facilityType: row.facility_type || "clinic",
    address: row.address || "",
    city: row.city || "Seoul",
    district: row.district || "",
    countryCode: row.country_code || "KR",
    defaultCommissionCapRate: Number(row.default_commission_cap_rate || 0.3),
    opsEmail: row.ops_email || "",
    region: row.district || row.city || "Seoul",
    specialty: row.facility_type || "clinic",
    registrationVerified: Boolean(row.medical_korea_registered),
    medicalKoreaRegistered: Boolean(row.medical_korea_registered),
    insuranceVerified:
      profile.data_source_status === "verified_docs" ||
      profile.data_source_status === "contracted",
    languages: profile.supported_languages || row.languages || ["en", "ko"],
    slaHours: standardSlaHours,
    urgentSlaHours: Number(
      profile.urgent_sla_hours || Math.min(6, standardSlaHours)
    ),
    quoteTemplateReady: Boolean(profile.quote_template_ready),
    depositPolicyReady: Boolean(profile.deposit_policy_ready),
    slaStatus: profile.sla_contract_status || "draft",
    active: Boolean(row.active),
    betaScore: Number(row.quality_score || 80),
    qualityScore: Number(row.quality_score || 80),
    owner: "Ops",
    nextStep: profile.next_step || "Request quote",
    matchedCases: 0,
    quotesSent: 0,
    depositsPaid: 0,
    slaBreaches: 0,
    complaints: 0,
    platformRevenueUsd: 0,
  };
}

function normalizeQuote(row) {
  return {
    id: row.id,
    quoteRequestId: row.quote_request_id,
    caseId: row.case_id,
    providerId: row.provider_id,
    medicalFeeUsd: Number(row.medical_fee || 0),
    nonmedicalFeeUsd: Number(row.nonmedical_fee || 0),
    commissionRate: Number(row.commission_rate || 0),
    capRate: Number(row.commission_cap_rate || 0),
    depositAmountUsd: Number(row.deposit_amount || 0),
    currency: row.currency || "USD",
    validUntil: row.valid_until,
    status: row.status,
    sentAt: row.sent_at,
    notes: row.notes || "",
    createdAt: row.created_at,
  };
}

function normalizeAvailabilitySlot(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    doctorId: row.doctor_id || null,
    procedureId: row.procedure_id || null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    languageSupport: row.language_support || [],
    holdExpiresAt: row.hold_expires_at || null,
    holdCaseId: row.hold_case_id || null,
    holdQuoteId: row.hold_quote_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeBooking(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    quoteId: row.quote_id,
    providerId: row.provider_id,
    scheduledAt: row.scheduled_at,
    visitType: row.visit_type,
    status: row.status,
    confirmedAt: row.confirmed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProviderQuoteRequest({
  quoteRequest,
  caseRow,
  lead,
  intake,
  provider,
  quote,
}) {
  return {
    id: quoteRequest.id,
    caseId: quoteRequest.case_id,
    providerId: quoteRequest.provider_id,
    providerName: provider
      ? displayName(provider.name_display, provider.name_legal)
      : "Provider",
    patientAlias: lead?.name || `Case ${quoteRequest.case_id.slice(0, 8)}`,
    procedure:
      lead?.treatment_interest ||
      lead?.attribution?.package_interest ||
      "Consultation request",
    market: marketFromLead(lead),
    language: lead?.preferred_language || "en",
    budgetMinUsd: Number(lead?.budget_min || intake?.budget_min || 0),
    budgetMaxUsd: Number(lead?.budget_max || intake?.budget_max || 0),
    travelStart: intake?.travel_start_date || "TBD",
    travelEnd: intake?.travel_end_date || "TBD",
    status: quoteRequest.status,
    dueAt: quoteRequest.due_at,
    requestedAt: quoteRequest.requested_at,
    notes: quoteRequest.notes || "",
    caseStatus: normalizeStatus(caseRow?.status),
    quote: quote ? normalizeQuote(quote) : null,
  };
}

function normalizeActivity(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    actorRole: row.actor_role,
    actorLabel: row.actor_label,
    eventType: row.event_type,
    eventPayload: row.event_payload || {},
    createdAt: row.created_at,
  };
}

function normalizeLandingRoute(row) {
  return {
    id: row.id,
    locale: row.locale,
    slug: row.slug,
    market: row.market,
    intent: row.intent || "",
    title: row.title || "",
    subtitle: row.subtitle || "",
    searchTheme: row.search_theme || "",
    cta: row.cta || "",
    secondaryCta: row.secondary_cta || "",
    packageIds: row.package_ids || [],
    status: row.status || "draft",
    source: row.source || "admin",
    active: Boolean(row.active),
    publishedAt: row.published_at || null,
    updatedAt: row.updated_at,
    translations: row.translations || {},
    translationSourceLocale: row.translation_source_locale || "ko",
    translationProvider: row.translation_provider || null,
    translatedAt: row.translated_at || null,
  };
}

function normalizePackageSku(row) {
  return {
    id: row.id,
    shortTitle: row.short_title || row.id,
    market: row.market || "global",
    category: row.category || "skin",
    priceMinUsd: Number(row.price_min_usd || 0),
    priceMaxUsd: Number(row.price_max_usd || 0),
    durationDays: Number(row.duration_days || 1),
    recoveryWindow: row.recovery_window || "",
    coordinatorLanguages: row.coordinator_languages || [],
    bestFor: row.best_for || "",
    includes: row.includes || [],
    complianceNote: row.compliance_note || "",
    source: row.source || "admin",
    active: Boolean(row.active),
    updatedAt: row.updated_at,
    translations: row.translations || {},
    translationSourceLocale: row.translation_source_locale || "ko",
    translationProvider: row.translation_provider || null,
    translatedAt: row.translated_at || null,
  };
}

function normalizeContactChannel(row) {
  return {
    channel: row.channel,
    label: row.label,
    href: row.href,
    officialAccountId: row.official_account_id || null,
    officialVerified: Boolean(row.official_verified),
    active: Boolean(row.active),
    displayOrder: Number(row.display_order || 0),
    notes: row.notes || null,
  };
}

function normalizeProviderOperatingProfile(row) {
  return {
    providerId: row.provider_id,
    publicExposureStatus: row.public_exposure_status,
    dataSourceStatus: row.data_source_status,
    supportedMarkets: row.supported_markets || [],
    supportedLanguages: row.supported_languages || [],
    standardSlaHours: Number(row.standard_sla_hours || 24),
    urgentSlaHours: Number(row.urgent_sla_hours || 6),
    priceRangeUsdMin:
      row.price_range_usd_min === null ? null : Number(row.price_range_usd_min),
    priceRangeUsdMax:
      row.price_range_usd_max === null ? null : Number(row.price_range_usd_max),
    quoteTemplateReady: Boolean(row.quote_template_ready),
    depositPolicyReady: Boolean(row.deposit_policy_ready),
    slaContractStatus: row.sla_contract_status,
    verificationSummary: row.verification_summary || null,
    sourceNotes: row.source_notes || null,
    lastVerifiedAt: row.last_verified_at || null,
    nextStep: row.next_step || null,
  };
}

function normalizeProviderPublicProfile(row) {
  return {
    providerId: row.provider_id,
    slug: row.slug,
    status: row.status,
    specialty: row.specialty || null,
    region: row.region || null,
    phonePublic: row.phone_public || null,
    websiteUrl: row.website_url || null,
    priceTier: row.price_tier || null,
    rating: row.rating === null ? null : Number(row.rating),
    reviewCount: Number(row.review_count || 0),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    featured: Boolean(row.featured),
    publishedAt: row.published_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeProviderPublicI18n(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    locale: row.locale,
    name: row.name || "",
    summary: row.summary || null,
    description: row.description || null,
    address: row.address || null,
    specialties: row.specialties || [],
    highlights: row.highlights || [],
    metaTitle: row.meta_title || null,
    metaDescription: row.meta_description || null,
  };
}

function normalizeProviderPublicMedia(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    mediaType: row.media_type,
    storagePath: row.storage_path || null,
    publicUrl: row.public_url || null,
    altText: row.alt_text || null,
    displayOrder: Number(row.display_order || 0),
    active: Boolean(row.active),
  };
}

function normalizeProviderPublicDoctor(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name || "",
    title: row.title || null,
    specialty: row.specialty || null,
    bio: row.bio || null,
    photoUrl: row.photo_url || null,
    yearsExperience:
      row.years_experience === null ? null : Number(row.years_experience),
    displayOrder: Number(row.display_order || 0),
    active: Boolean(row.active),
  };
}

function normalizeProviderPublicTreatment(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    treatmentSlug: row.treatment_slug || null,
    title: row.title || "",
    priceMinKrw: row.price_min_krw === null ? null : Number(row.price_min_krw),
    priceMaxKrw: row.price_max_krw === null ? null : Number(row.price_max_krw),
    recoveryDays: row.recovery_days === null ? null : Number(row.recovery_days),
    durationMinutes:
      row.duration_minutes === null ? null : Number(row.duration_minutes),
    notes: row.notes || null,
    active: Boolean(row.active),
  };
}

async function getAdminOperationsData(config) {
  if (config.role !== "admin") {
    return {
      landingRoutes: [],
      packageSkus: [],
      contactChannels: [],
      providerOperatingProfiles: [],
      providerPublicProfiles: [],
      providerPublicProfileI18n: [],
      providerPublicMedia: [],
      providerPublicDoctors: [],
      providerPublicTreatments: [],
    };
  }

  const [
    landingRoutes,
    packageSkus,
    contactChannels,
    providerOperatingProfiles,
    providerPublicProfiles,
    providerPublicProfileI18n,
    providerPublicMedia,
    providerPublicDoctors,
    providerPublicTreatments,
  ] = await Promise.all([
    safeList(
      config,
      "admin_landing_routes",
      "select=id,locale,slug,market,intent,title,subtitle,search_theme,cta,secondary_cta,package_ids,status,source,active,published_at,updated_at,translations,translation_source_locale,translation_provider,translated_at&active=eq.true&order=updated_at.desc&limit=120"
    ),
    safeList(
      config,
      "admin_package_skus",
      "select=id,short_title,market,category,price_min_usd,price_max_usd,duration_days,recovery_window,coordinator_languages,best_for,includes,compliance_note,source,active,updated_at,translations,translation_source_locale,translation_provider,translated_at&order=updated_at.desc&limit=240"
    ),
    safeList(
      config,
      "contact_channel_settings",
      "select=channel,label,href,official_account_id,official_verified,active,display_order,notes&order=display_order.asc"
    ),
    safeList(
      config,
      "provider_operating_profiles",
      "select=provider_id,public_exposure_status,data_source_status,supported_markets,supported_languages,standard_sla_hours,urgent_sla_hours,price_range_usd_min,price_range_usd_max,quote_template_ready,deposit_policy_ready,sla_contract_status,verification_summary,source_notes,last_verified_at,next_step&order=updated_at.desc&limit=120"
    ),
    safeList(
      config,
      "provider_public_profiles",
      "select=provider_id,slug,status,specialty,region,phone_public,website_url,price_tier,rating,review_count,latitude,longitude,featured,published_at,updated_at&order=updated_at.desc&limit=240"
    ),
    safeList(
      config,
      "provider_public_profile_i18n",
      "select=id,provider_id,locale,name,summary,description,address,specialties,highlights,meta_title,meta_description&order=updated_at.desc&limit=480"
    ),
    safeList(
      config,
      "provider_public_media",
      "select=id,provider_id,media_type,storage_path,public_url,alt_text,display_order,active&order=display_order.asc&limit=480"
    ),
    safeList(
      config,
      "provider_public_doctors",
      "select=id,provider_id,name,title,specialty,bio,photo_url,years_experience,display_order,active&order=display_order.asc&limit=480"
    ),
    safeList(
      config,
      "provider_public_treatments",
      "select=id,provider_id,treatment_slug,title,price_min_krw,price_max_krw,recovery_days,duration_minutes,notes,active&order=created_at.asc&limit=5000"
    ),
  ]);

  return {
    landingRoutes: landingRoutes.map(normalizeLandingRoute),
    packageSkus: packageSkus.map(normalizePackageSku),
    contactChannels: contactChannels.map(normalizeContactChannel),
    providerOperatingProfiles: providerOperatingProfiles.map(
      normalizeProviderOperatingProfile
    ),
    providerPublicProfiles: providerPublicProfiles.map(
      normalizeProviderPublicProfile
    ),
    providerPublicProfileI18n: providerPublicProfileI18n.map(
      normalizeProviderPublicI18n
    ),
    providerPublicMedia: providerPublicMedia.map(normalizeProviderPublicMedia),
    providerPublicDoctors: providerPublicDoctors.map(
      normalizeProviderPublicDoctor
    ),
    providerPublicTreatments: providerPublicTreatments.map(
      normalizeProviderPublicTreatment
    ),
  };
}

function notificationDispatchConfigured() {
  return Boolean(
    process.env.NOTIFICATION_WEBHOOK_URL ||
    process.env.RESEND_API_KEY ||
    process.env.KAKAO_API_KEY ||
    process.env.WHATSAPP_TOKEN
  );
}

function paymentMode() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "not_configured";
}

function scopeSnapshot(config, snapshot) {
  let {
    cases,
    partners,
    providers,
    providerQuoteRequests,
    quotes,
    availabilitySlots = [],
    bookings = [],
    activities,
  } = snapshot;

  if (config.role === "partner" && config.partnerId) {
    partners = partners.filter(row => row.id === config.partnerId);
    cases = cases.filter(row => row.assignedPartnerId === config.partnerId);
    const caseIds = new Set(cases.map(row => row.id));
    providerQuoteRequests = providerQuoteRequests.filter(row =>
      caseIds.has(row.caseId)
    );
    quotes = quotes.filter(row => caseIds.has(row.caseId));
    bookings = bookings.filter(row => caseIds.has(row.caseId));
    const providerIds = new Set(bookings.map(row => row.providerId));
    availabilitySlots = availabilitySlots.filter(row =>
      providerIds.has(row.providerId)
    );
    activities = activities.filter(row => caseIds.has(row.caseId));
  }

  if (config.role === "provider" && config.providerId) {
    providers = providers.filter(row => row.id === config.providerId);
    providerQuoteRequests = providerQuoteRequests.filter(
      row => row.providerId === config.providerId
    );
    const caseIds = new Set(providerQuoteRequests.map(row => row.caseId));
    cases = cases.filter(row => caseIds.has(row.id));
    quotes = quotes.filter(row => row.providerId === config.providerId);
    availabilitySlots = availabilitySlots.filter(
      row => row.providerId === config.providerId
    );
    bookings = bookings.filter(row => row.providerId === config.providerId);
    activities = activities.filter(row => caseIds.has(row.caseId));
    partners = [];
  }

  return {
    cases,
    partners,
    providers,
    providerQuoteRequests,
    quotes,
    availabilitySlots,
    bookings,
    activities,
  };
}

async function getSnapshot(config) {
  const requests = await list(
    config,
    "partner_service_requests",
    "select=id,lead_id,case_id,assistance_mode,requested_services,patient_notes,consent_to_share_with_partners,status,request_snapshot,created_at,updated_at&order=created_at.desc&limit=80"
  );

  const caseIds = Array.from(
    new Set(requests.map(row => row.case_id).filter(Boolean))
  );
  const leadIds = Array.from(
    new Set(requests.map(row => row.lead_id).filter(Boolean))
  );
  const reservationWindowStart = encodeURIComponent(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  );
  const reservationWindowEnd = encodeURIComponent(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  );

  const [
    cases,
    leads,
    intakes,
    assignments,
    shortlists,
    quoteRequests,
    quotes,
    activities,
    partnersRaw,
    providersRaw,
    relationships,
    providerOperatingProfilesRaw,
    opsAccessRaw,
    availabilitySlotsRaw,
    bookingsRaw,
  ] = await Promise.all([
    caseIds.length
      ? list(
          config,
          "cases",
          `select=id,lead_id,patient_id,status,priority,source,created_at,updated_at&id=${inFilter(caseIds)}`
        )
      : [],
    leadIds.length
      ? list(
          config,
          "leads",
          `select=id,name,nationality,residence_country,preferred_language,treatment_interest,budget_min,budget_max,currency,source,attribution,created_at,updated_at&id=${inFilter(leadIds)}`
        )
      : [],
    caseIds.length
      ? list(
          config,
          "medical_intakes",
          `select=case_id,budget_min,budget_max,currency,travel_start_date,travel_end_date,risk_flags,chief_request,submitted_at&case_id=${inFilter(caseIds)}`
        )
      : [],
    caseIds.length
      ? list(
          config,
          "case_partner_assignments",
          `select=case_id,partner_id,assignment_role,status,assigned_at&status=in.(assigned,accepted)&case_id=${inFilter(caseIds)}`
        )
      : [],
    caseIds.length
      ? list(
          config,
          "partner_provider_shortlists",
          `select=case_id,partner_id,provider_id,selection_status,rank,quote_request_ready,created_at&case_id=${inFilter(caseIds)}`
        )
      : [],
    caseIds.length
      ? list(
          config,
          "quote_requests",
          `select=id,case_id,provider_id,status,due_at,notes,requested_at&case_id=${inFilter(caseIds)}`
        )
      : [],
    caseIds.length
      ? list(
          config,
          "quotes",
          `select=id,quote_request_id,case_id,provider_id,medical_fee,nonmedical_fee,currency,commission_rate,commission_cap_rate,deposit_amount,valid_until,status,notes,sent_at,created_at,updated_at&case_id=${inFilter(caseIds)}&order=created_at.desc`
        )
      : [],
    caseIds.length
      ? safeList(
          config,
          "case_activity_events",
          `select=id,case_id,actor_role,actor_label,event_type,event_payload,created_at&case_id=${inFilter(caseIds)}&order=created_at.desc&limit=120`
        )
      : [],
    list(
      config,
      "partners",
      "select=id,name,partner_type,contact_email,contact_phone,default_revenue_share_rate,active&active=eq.true&order=name.asc"
    ),
    list(
      config,
      "providers",
      "select=id,name_legal,name_display,facility_type,address,city,district,country_code,medical_korea_registered,active,default_commission_cap_rate,average_response_minutes,quality_score&active=eq.true&order=quality_score.desc"
    ),
    list(
      config,
      "partner_provider_relationships",
      "select=partner_id,provider_id,relationship_status,allowed_services,active&active=eq.true"
    ),
    safeList(
      config,
      "provider_operating_profiles",
      "select=provider_id,public_exposure_status,data_source_status,supported_markets,supported_languages,standard_sla_hours,urgent_sla_hours,quote_template_ready,deposit_policy_ready,sla_contract_status,next_step"
    ),
    config.role === "admin"
      ? safeList(
          config,
          "ops_user_access",
          "select=email,role,partner_id,provider_id,active&active=eq.true"
        )
      : [],
    safeList(
      config,
      "availability_slots",
      `select=*&starts_at=gte.${reservationWindowStart}&starts_at=lt.${reservationWindowEnd}&order=starts_at.asc&limit=240`
    ),
    safeList(
      config,
      "bookings",
      `select=*&scheduled_at=gte.${reservationWindowStart}&scheduled_at=lt.${reservationWindowEnd}&order=scheduled_at.asc&limit=240`
    ),
  ]);

  const caseMap = new Map(cases.map(row => [row.id, row]));
  const leadMap = new Map(leads.map(row => [row.id, row]));
  const intakeMap = new Map(intakes.map(row => [row.case_id, row]));
  const assignmentMap = new Map(assignments.map(row => [row.case_id, row]));
  const providerMap = new Map(providersRaw.map(row => [row.id, row]));
  const operatingProfileMap = new Map(
    providerOperatingProfilesRaw.map(row => [row.provider_id, row])
  );
  const providerOpsEmailMap = new Map();
  const partnerOpsEmailMap = new Map();
  const quoteByRequest = new Map();
  const quotesByCase = new Map();
  const shortlistsByCase = new Map();
  const quoteRequestsByCase = new Map();

  for (const row of opsAccessRaw) {
    if (
      row.role === "provider" &&
      row.provider_id &&
      !providerOpsEmailMap.has(row.provider_id)
    ) {
      providerOpsEmailMap.set(row.provider_id, row.email);
    }
    if (
      row.role === "partner" &&
      row.partner_id &&
      !partnerOpsEmailMap.has(row.partner_id)
    ) {
      partnerOpsEmailMap.set(row.partner_id, row.email);
    }
  }

  for (const row of quotes) {
    if (row.quote_request_id && !quoteByRequest.has(row.quote_request_id))
      quoteByRequest.set(row.quote_request_id, row);
    const listRows = quotesByCase.get(row.case_id) || [];
    listRows.push(row);
    quotesByCase.set(row.case_id, listRows);
  }

  for (const row of shortlists) {
    const listRows = shortlistsByCase.get(row.case_id) || [];
    listRows.push(row);
    shortlistsByCase.set(row.case_id, listRows);
  }

  for (const row of quoteRequests) {
    const listRows = quoteRequestsByCase.get(row.case_id) || [];
    listRows.push(row);
    quoteRequestsByCase.set(row.case_id, listRows);
  }

  const relationshipsByPartner = new Map();
  const servicesByPartner = new Map();
  for (const row of relationships) {
    const providerIds = relationshipsByPartner.get(row.partner_id) || [];
    if (row.relationship_status !== "blocked") {
      providerIds.push(row.provider_id);
      const services = servicesByPartner.get(row.partner_id) || new Set();
      for (const service of row.allowed_services || []) services.add(service);
      servicesByPartner.set(row.partner_id, services);
    }
    relationshipsByPartner.set(row.partner_id, providerIds);
  }

  const casesNormalized = requests
    .map(request =>
      normalizeCase({
        request,
        caseRow: caseMap.get(request.case_id),
        lead: leadMap.get(request.lead_id),
        intake: intakeMap.get(request.case_id),
        assignment: assignmentMap.get(request.case_id),
        shortlists: shortlistsByCase.get(request.case_id) || [],
        quoteRequests: quoteRequestsByCase.get(request.case_id) || [],
      })
    )
    .filter(row => row.id);

  const partners = partnersRaw.map(row =>
    normalizePartner({
      ...row,
      preferred_provider_ids: relationshipsByPartner.get(row.id) || [],
      services: Array.from(servicesByPartner.get(row.id) || []),
      ops_email: partnerOpsEmailMap.get(row.id) || "",
    })
  );
  const providers = providersRaw.map(row =>
    normalizeProvider({
      ...row,
      operating_profile: operatingProfileMap.get(row.id),
      ops_email: providerOpsEmailMap.get(row.id) || "",
    })
  );
  const providerQuoteRequests = quoteRequests.map(quoteRequest =>
    normalizeProviderQuoteRequest({
      quoteRequest,
      caseRow: caseMap.get(quoteRequest.case_id),
      lead: leadMap.get(caseMap.get(quoteRequest.case_id)?.lead_id),
      intake: intakeMap.get(quoteRequest.case_id),
      provider: providerMap.get(quoteRequest.provider_id),
      quote: quoteByRequest.get(quoteRequest.id),
    })
  );

  const scoped = scopeSnapshot(config, {
    cases: casesNormalized,
    partners,
    providers,
    providerQuoteRequests,
    quotes: quotes.map(normalizeQuote),
    availabilitySlots: availabilitySlotsRaw.map(normalizeAvailabilitySlot),
    bookings: bookingsRaw.map(normalizeBooking),
    activities: activities.map(normalizeActivity),
  });
  const [
    leadStorageHealth,
    adminPersistenceHealth,
    adminOperationsData,
    partnerServiceRequestTotal,
    quoteRequestTotal,
  ] = await Promise.all([
    getLeadStorageHealth(config),
    config.role === "admin"
      ? getAdminPersistenceHealth(config)
      : Promise.resolve(null),
    getAdminOperationsData(config),
    config.role === "admin"
      ? supabaseCount(config, "partner_service_requests")
      : Promise.resolve(requests.length),
    config.role === "admin"
      ? supabaseCount(config, "quote_requests")
      : Promise.resolve(scoped.providerQuoteRequests.length),
  ]);

  return {
    ...scoped,
    ...adminOperationsData,
    meta: {
      mode: "supabase",
      role: config.role,
      scopedAccountId: config.scopedAccountId,
      scopedAccountEnabled: Boolean(config.scopedAccountId),
      authMethod: config.authMethod || "email",
      authEmail: config.authEmail || null,
      emailAccessConfigured: config.authMethod === "email",
      roleTokensConfigured: {
        admin: Boolean(config.roleTokens.adminToken),
        partner: Boolean(
          config.roleTokens.partnerToken || config.roleTokens.partnerMap.size
        ),
        provider: Boolean(
          config.roleTokens.providerToken || config.roleTokens.providerMap.size
        ),
        partnerScoped: config.roleTokens.partnerMap.size > 0,
        providerScoped: config.roleTokens.providerMap.size > 0,
      },
      notificationDispatchConfigured: notificationDispatchConfigured(),
      notificationOutboxConfigured: true,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      paymentMode: paymentMode(),
      leadStorageHealth,
      adminPersistenceHealth,
      partnerServiceRequestTableReady: partnerServiceRequestTotal !== null,
      quoteRequestTableReady: quoteRequestTotal !== null,
      partnerRequestCount: partnerServiceRequestTotal ?? scoped.cases.length,
      quoteRequestCount:
        quoteRequestTotal ?? scoped.providerQuoteRequests.length,
      quoteResponseCount: scoped.quotes.length,
      generatedAt: new Date().toISOString(),
      hasDbPartners: scoped.partners.length > 0,
      hasDbProviders: scoped.providers.length > 0,
    },
  };
}

const LANDING_ROUTE_LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;
const LANDING_ROUTE_MARKET_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const PACKAGE_SKU_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const LANDING_ROUTE_STATUSES = new Set([
  "draft",
  "published",
  "paused",
  "archived",
]);
const DEFAULT_TRANSLATION_TARGET_LOCALES = ["en", "ja", "zh", "ar"];
const TRANSLATION_LOCALE_ALIASES = {
  jp: "ja",
  "zh-cn": "zh",
  "zh-tw": "zh",
};
const LANDING_TRANSLATION_FIELDS = [
  "intent",
  "title",
  "subtitle",
  "searchTheme",
  "cta",
  "secondaryCta",
];
const PACKAGE_TRANSLATION_FIELDS = [
  "shortTitle",
  "recoveryWindow",
  "bestFor",
  "includes",
  "complianceNote",
];
const FACILITY_TYPES = new Set([
  "clinic",
  "hospital",
  "general_hospital",
  "tertiary_hospital",
]);
const PROVIDER_EXPOSURE_STATUSES = new Set([
  "blocked",
  "candidate",
  "ready",
  "published",
]);
const PROVIDER_DATA_SOURCE_STATUSES = new Set([
  "demo_seed",
  "candidate",
  "verified_docs",
  "contracted",
]);
const SLA_CONTRACT_STATUSES = new Set([
  "draft",
  "sent",
  "negotiating",
  "pending_docs",
  "signed",
]);
const PROVIDER_PUBLIC_STATUSES = new Set([
  "draft",
  "review_requested",
  "ready",
  "published",
  "paused",
]);
const PUBLIC_PRICE_TIERS = new Set(["$", "$$", "$$$"]);
const PUBLIC_LOCALES = new Set([
  "ko",
  "en",
  "ja",
  "zh",
  "th",
  "vi",
  "ar",
  "ru",
]);
const PARTNER_TYPES = new Set([
  "agency",
  "personal_agent",
  "interpreter",
  "travel_agency",
  "concierge",
]);

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanPackageIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(item => sanitizeText(item).slice(0, 80)).filter(Boolean))
  );
}

function cleanTextArray(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(item => sanitizeText(item).toLowerCase()).filter(Boolean))
  ).slice(0, limit);
}

function cleanStringArray(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(item => sanitizeText(item).slice(0, 160)).filter(Boolean))
  ).slice(0, limit);
}

function normalizeTranslationLocale(locale, fallback = "ko") {
  const normalized = sanitizeText(locale, fallback).toLowerCase();
  const aliased = TRANSLATION_LOCALE_ALIASES[normalized] || normalized;
  return LANDING_ROUTE_LOCALE_PATTERN.test(aliased) ? aliased : fallback;
}

function cleanTranslationLocales(value, sourceLocale) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : DEFAULT_TRANSLATION_TARGET_LOCALES;
  return Array.from(
    new Set(
      raw
        .map(item => normalizeTranslationLocale(item, ""))
        .filter(locale => locale && locale !== sourceLocale)
    )
  ).slice(0, 12);
}

function cleanLocalizedCopy(value, fields) {
  if (!value || typeof value !== "object") return null;
  const copy = {};
  for (const field of fields) {
    if (field === "includes") {
      const includes = cleanStringArray(value[field], 16);
      if (includes.length) copy[field] = includes;
      continue;
    }
    const text = sanitizeText(value[field]);
    if (text) copy[field] = text;
  }
  return Object.keys(copy).length ? copy : null;
}

function cleanTranslations(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const translations = {};
  for (const [rawLocale, rawCopy] of Object.entries(value)) {
    const locale = normalizeTranslationLocale(rawLocale, "");
    const copy = cleanLocalizedCopy(rawCopy, fields);
    if (locale && copy) translations[locale] = copy;
  }
  return translations;
}

function mergeTranslations(current, next) {
  const merged = { ...current };
  for (const [locale, copy] of Object.entries(next || {})) {
    merged[locale] = { ...(merged[locale] || {}), ...copy };
  }
  return merged;
}

function hasTranslatableCopy(copy) {
  return Object.values(copy || {}).some(value =>
    Array.isArray(value) ? value.length > 0 : Boolean(sanitizeText(value))
  );
}

function openAiTranslationModel() {
  return process.env.OPENAI_TRANSLATION_MODEL || "gpt-4.1-mini";
}

function readOpenAiText(payload) {
  const choiceText = payload?.choices?.[0]?.message?.content;
  if (choiceText) return choiceText;
  if (payload?.output_text) return payload.output_text;
  const output = payload?.output;
  if (!Array.isArray(output)) return "";
  return output
    .flatMap(item => item?.content || [])
    .map(item => item?.text || "")
    .filter(Boolean)
    .join("\n");
}

async function translateAdminCopy({
  contentType,
  sourceLocale,
  targetLocales,
  fields,
  sourceCopy,
}) {
  if (!targetLocales.length || !hasTranslatableCopy(sourceCopy)) return {};

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      503,
      "OPENAI_API_KEY is not configured for automatic translation."
    );
  }

  const model = openAiTranslationModel();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Translate the supplied medical tourism admin copy from its source locale into the requested locales. Preserve field names and arrays. Do not add medical guarantees, superlatives, unverifiable claims, prices, or clinical promises. Keep package codes, numbers, durations, and currency values unchanged. Return only valid JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            contentType,
            sourceLocale,
            targetLocales,
            fields,
            sourceCopy,
            responseShape:
              "Return {\"translations\":{\"locale\":{\"field\":\"translated text\"}}}.",
          }),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(
      response.status,
      payload?.error?.message || "Automatic translation request failed."
    );
  }

  const text = readOpenAiText(payload);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new HttpError(502, "Automatic translation returned invalid JSON.");
  }

  return cleanTranslations(parsed?.translations || parsed, fields);
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function nullableMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function createProvider(config, body) {
  const input = body.provider || body;
  const nameLegal = sanitizeText(input.nameLegal || input.name_legal);
  const nameDisplayKo = sanitizeText(
    input.nameDisplayKo || input.nameKo || input.nameDisplay || input.name
  );
  const nameDisplayEn = sanitizeText(
    input.nameDisplayEn || input.nameEn || input.nameDisplay || nameLegal
  );
  const facilityType = sanitizeText(
    input.facilityType || input.facility_type,
    "clinic"
  ).toLowerCase();
  const address = sanitizeText(input.address);
  const city = sanitizeText(input.city, "Seoul");
  const district = sanitizeText(input.district);
  const countryCode = sanitizeText(
    input.countryCode || input.country_code,
    "KR"
  )
    .toUpperCase()
    .slice(0, 2);
  const opsEmail = sanitizeText(
    input.opsEmail || input.ops_email
  ).toLowerCase();
  const standardSlaHours = Math.round(
    numberInRange(
      input.standardSlaHours ?? input.standard_sla_hours,
      24,
      1,
      168
    )
  );
  const urgentSlaHours = Math.round(
    numberInRange(
      input.urgentSlaHours ?? input.urgent_sla_hours,
      6,
      1,
      standardSlaHours
    )
  );
  const publicExposureStatus = sanitizeText(
    input.publicExposureStatus ?? input.public_exposure_status,
    "candidate"
  ).toLowerCase();
  const dataSourceStatus = sanitizeText(
    input.dataSourceStatus ?? input.data_source_status,
    "candidate"
  ).toLowerCase();
  const slaContractStatus = sanitizeText(
    input.slaContractStatus ?? input.sla_contract_status,
    "draft"
  ).toLowerCase();
  const priceMin = nullableMoney(
    input.priceRangeUsdMin ?? input.price_range_usd_min
  );
  const priceMax = nullableMoney(
    input.priceRangeUsdMax ?? input.price_range_usd_max
  );

  if (!nameLegal || !nameDisplayKo || !address)
    throw new HttpError(
      400,
      "Provider name, display name, and address are required."
    );
  if (!FACILITY_TYPES.has(facilityType))
    throw new HttpError(400, "Unsupported provider facility type.");
  if (!PROVIDER_EXPOSURE_STATUSES.has(publicExposureStatus))
    throw new HttpError(400, "Unsupported provider exposure status.");
  if (!PROVIDER_DATA_SOURCE_STATUSES.has(dataSourceStatus))
    throw new HttpError(400, "Unsupported provider data source status.");
  if (!SLA_CONTRACT_STATUSES.has(slaContractStatus))
    throw new HttpError(400, "Unsupported provider SLA status.");
  if (priceMin !== null && priceMax !== null && priceMax < priceMin)
    throw new HttpError(
      400,
      "Provider price max must be greater than or equal to price min."
    );

  const providerRows = await supabaseFetch(config, "providers", {
    method: "POST",
    body: JSON.stringify({
      name_legal: nameLegal,
      name_display: { ko: nameDisplayKo, en: nameDisplayEn || nameDisplayKo },
      facility_type: facilityType,
      address,
      city,
      district: district || null,
      country_code: countryCode || "KR",
      medical_korea_registered: Boolean(
        input.medicalKoreaRegistered || input.medical_korea_registered
      ),
      active: input.active !== false,
      default_commission_cap_rate: numberInRange(
        input.defaultCommissionCapRate ?? input.default_commission_cap_rate,
        0.3,
        0,
        0.3
      ),
      average_response_minutes: standardSlaHours * 60,
      quality_score: numberInRange(
        input.qualityScore ?? input.quality_score,
        70,
        0,
        100
      ),
    }),
    prefer: "return=representation",
  });

  const provider = providerRows?.[0];
  if (!provider?.id) throw new HttpError(409, "Provider could not be created.");

  await supabaseFetch(
    config,
    "provider_operating_profiles?on_conflict=provider_id",
    {
      method: "POST",
      body: JSON.stringify({
        provider_id: provider.id,
        public_exposure_status: publicExposureStatus,
        data_source_status: dataSourceStatus,
        supported_markets: cleanTextArray(
          input.supportedMarkets || input.supported_markets
        ),
        supported_languages: cleanTextArray(
          input.supportedLanguages || input.supported_languages
        ),
        standard_sla_hours: standardSlaHours,
        urgent_sla_hours: urgentSlaHours,
        price_range_usd_min: priceMin,
        price_range_usd_max: priceMax,
        quote_template_ready: Boolean(
          input.quoteTemplateReady || input.quote_template_ready
        ),
        deposit_policy_ready: Boolean(
          input.depositPolicyReady || input.deposit_policy_ready
        ),
        sla_contract_status: slaContractStatus,
        verification_summary: sanitizeText(
          input.verificationSummary || input.verification_summary
        ),
        source_notes: sanitizeText(input.sourceNotes || input.source_notes),
        next_step: sanitizeText(
          input.nextStep || input.next_step,
          "검증 서류 확인"
        ),
        updated_at: new Date().toISOString(),
      }),
      prefer: "resolution=merge-duplicates,return=minimal",
    }
  );

  if (opsEmail) {
    await supabaseFetch(config, "ops_user_access?on_conflict=email", {
      method: "POST",
      body: JSON.stringify({
        email: opsEmail,
        role: "provider",
        provider_id: provider.id,
        partner_id: null,
        active: true,
        notes: `Provider access created from admin provider registry for ${nameLegal}.`,
        updated_at: new Date().toISOString(),
      }),
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  return { ok: true, providerId: provider.id };
}

async function createPartner(config, body) {
  const input = body.partner || body;
  const name = sanitizeText(input.name);
  const partnerType = sanitizeText(
    input.partnerType || input.partner_type,
    "agency"
  ).toLowerCase();
  const contactEmail = sanitizeText(
    input.contactEmail || input.contact_email
  ).toLowerCase();
  const opsEmail = sanitizeText(
    input.opsEmail || input.ops_email || contactEmail
  ).toLowerCase();
  const contactPhone = sanitizeText(input.contactPhone || input.contact_phone);
  const preferredProviderIds = Array.isArray(
    input.preferredProviderIds || input.preferred_provider_ids
  )
    ? (input.preferredProviderIds || input.preferred_provider_ids)
        .map(item => sanitizeText(item))
        .filter(Boolean)
    : [];
  const services = cleanTextArray(input.services, 12);

  if (!name) throw new HttpError(400, "Partner name is required.");
  if (!PARTNER_TYPES.has(partnerType))
    throw new HttpError(400, "Unsupported partner type.");
  for (const providerId of preferredProviderIds) {
    if (!isUuid(providerId))
      throw new HttpError(400, "Preferred provider IDs must be valid UUIDs.");
  }

  const partnerRows = await supabaseFetch(config, "partners", {
    method: "POST",
    body: JSON.stringify({
      name,
      partner_type: partnerType,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      default_revenue_share_rate: numberInRange(
        input.defaultRevenueShareRate ?? input.default_revenue_share_rate,
        0,
        0,
        1
      ),
      active: input.active !== false,
    }),
    prefer: "return=representation",
  });

  const partner = partnerRows?.[0];
  if (!partner?.id) throw new HttpError(409, "Partner could not be created.");

  if (preferredProviderIds.length) {
    await supabaseFetch(
      config,
      "partner_provider_relationships?on_conflict=partner_id,provider_id",
      {
        method: "POST",
        body: JSON.stringify(
          preferredProviderIds.map(providerId => ({
            partner_id: partner.id,
            provider_id: providerId,
            relationship_status: "preferred",
            allowed_services: services,
            notes: sanitizeText(input.notes || input.sourceNotes),
            active: true,
            updated_at: new Date().toISOString(),
          }))
        ),
        prefer: "resolution=merge-duplicates,return=minimal",
      }
    );
  }

  if (opsEmail) {
    await supabaseFetch(config, "ops_user_access?on_conflict=email", {
      method: "POST",
      body: JSON.stringify({
        email: opsEmail,
        role: "partner",
        partner_id: partner.id,
        provider_id: null,
        active: true,
        notes: `Partner access created from admin partner registry for ${name}.`,
        updated_at: new Date().toISOString(),
      }),
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  return { ok: true, partnerId: partner.id };
}

function parseProviderRegistryInput(body) {
  const input = body.provider || body;
  const nameLegal = sanitizeText(input.nameLegal || input.name_legal);
  const nameDisplayKo = sanitizeText(
    input.nameDisplayKo || input.nameKo || input.nameDisplay || input.name
  );
  const nameDisplayEn = sanitizeText(
    input.nameDisplayEn || input.nameEn || input.nameDisplay || nameLegal
  );
  const facilityType = sanitizeText(
    input.facilityType || input.facility_type,
    "clinic"
  ).toLowerCase();
  const address = sanitizeText(input.address);
  const city = sanitizeText(input.city, "Seoul");
  const district = sanitizeText(input.district);
  const countryCode = sanitizeText(
    input.countryCode || input.country_code,
    "KR"
  )
    .toUpperCase()
    .slice(0, 2);
  const opsEmail = sanitizeText(
    input.opsEmail || input.ops_email
  ).toLowerCase();
  const standardSlaHours = Math.round(
    numberInRange(
      input.standardSlaHours ?? input.standard_sla_hours,
      24,
      1,
      168
    )
  );
  const urgentSlaHours = Math.round(
    numberInRange(
      input.urgentSlaHours ?? input.urgent_sla_hours,
      6,
      1,
      standardSlaHours
    )
  );
  const publicExposureStatus = sanitizeText(
    input.publicExposureStatus ?? input.public_exposure_status,
    "candidate"
  ).toLowerCase();
  const dataSourceStatus = sanitizeText(
    input.dataSourceStatus ?? input.data_source_status,
    "candidate"
  ).toLowerCase();
  const slaContractStatus = sanitizeText(
    input.slaContractStatus ?? input.sla_contract_status,
    "draft"
  ).toLowerCase();
  const priceMin = nullableMoney(
    input.priceRangeUsdMin ?? input.price_range_usd_min
  );
  const priceMax = nullableMoney(
    input.priceRangeUsdMax ?? input.price_range_usd_max
  );

  return {
    input,
    nameLegal,
    nameDisplayKo,
    nameDisplayEn,
    facilityType,
    address,
    city,
    district,
    countryCode,
    opsEmail,
    standardSlaHours,
    urgentSlaHours,
    publicExposureStatus,
    dataSourceStatus,
    slaContractStatus,
    priceMin,
    priceMax,
  };
}

function assertProviderRegistryInput(parsed) {
  if (!parsed.nameLegal || !parsed.nameDisplayKo || !parsed.address)
    throw new HttpError(
      400,
      "Provider name, display name, and address are required."
    );
  if (!FACILITY_TYPES.has(parsed.facilityType))
    throw new HttpError(400, "Unsupported provider facility type.");
  if (!PROVIDER_EXPOSURE_STATUSES.has(parsed.publicExposureStatus))
    throw new HttpError(400, "Unsupported provider exposure status.");
  if (!PROVIDER_DATA_SOURCE_STATUSES.has(parsed.dataSourceStatus))
    throw new HttpError(400, "Unsupported provider data source status.");
  if (!SLA_CONTRACT_STATUSES.has(parsed.slaContractStatus))
    throw new HttpError(400, "Unsupported provider SLA status.");
  if (
    parsed.priceMin !== null &&
    parsed.priceMax !== null &&
    parsed.priceMax < parsed.priceMin
  ) {
    throw new HttpError(
      400,
      "Provider price max must be greater than or equal to price min."
    );
  }
}

function providerRegistryBasePayload(parsed, includeUpdatedAt = true) {
  return {
    name_legal: parsed.nameLegal,
    name_display: {
      ko: parsed.nameDisplayKo,
      en: parsed.nameDisplayEn || parsed.nameDisplayKo,
    },
    facility_type: parsed.facilityType,
    address: parsed.address,
    city: parsed.city,
    district: parsed.district || null,
    country_code: parsed.countryCode || "KR",
    medical_korea_registered: Boolean(
      parsed.input.medicalKoreaRegistered ||
      parsed.input.medical_korea_registered
    ),
    active: parsed.input.active !== false,
    default_commission_cap_rate: numberInRange(
      parsed.input.defaultCommissionCapRate ??
        parsed.input.default_commission_cap_rate,
      0.3,
      0,
      0.3
    ),
    average_response_minutes: parsed.standardSlaHours * 60,
    quality_score: numberInRange(
      parsed.input.qualityScore ?? parsed.input.quality_score,
      70,
      0,
      100
    ),
    ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
  };
}

function providerRegistryProfilePayload(providerId, parsed) {
  return {
    provider_id: providerId,
    public_exposure_status: parsed.publicExposureStatus,
    data_source_status: parsed.dataSourceStatus,
    supported_markets: cleanTextArray(
      parsed.input.supportedMarkets || parsed.input.supported_markets
    ),
    supported_languages: cleanTextArray(
      parsed.input.supportedLanguages || parsed.input.supported_languages
    ),
    standard_sla_hours: parsed.standardSlaHours,
    urgent_sla_hours: parsed.urgentSlaHours,
    price_range_usd_min: parsed.priceMin,
    price_range_usd_max: parsed.priceMax,
    quote_template_ready: Boolean(
      parsed.input.quoteTemplateReady || parsed.input.quote_template_ready
    ),
    deposit_policy_ready: Boolean(
      parsed.input.depositPolicyReady || parsed.input.deposit_policy_ready
    ),
    sla_contract_status: parsed.slaContractStatus,
    verification_summary: sanitizeText(
      parsed.input.verificationSummary || parsed.input.verification_summary
    ),
    source_notes: sanitizeText(
      parsed.input.sourceNotes || parsed.input.source_notes
    ),
    next_step: sanitizeText(
      parsed.input.nextStep || parsed.input.next_step,
      "검증 서류 확인"
    ),
    updated_at: new Date().toISOString(),
  };
}

function nullableNumber(value, min = -Infinity, max = Infinity) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
}

function cleanPublicStatus(value) {
  const status = sanitizeText(value, "draft").toLowerCase();
  return PROVIDER_PUBLIC_STATUSES.has(status) ? status : "draft";
}

function cleanPublicLocale(value) {
  const locale = sanitizeText(value, "en").toLowerCase();
  if (locale === "jp") return "ja";
  if (locale === "zh-cn" || locale === "zh-tw") return "zh";
  return PUBLIC_LOCALES.has(locale) ? locale : "en";
}

function publicProfileBasePayload(providerId, input, parsed) {
  const slug =
    slugify(input.slug || parsed.nameDisplayEn || parsed.nameLegal) ||
    `provider-${providerId.slice(0, 8)}`;
  const status = cleanPublicStatus(input.status);
  const priceTier = sanitizeText(input.priceTier || input.price_tier, "$$");
  return {
    provider_id: providerId,
    slug,
    status,
    specialty: sanitizeText(input.specialty || parsed.facilityType),
    region: sanitizeText(input.region || parsed.district || parsed.city),
    phone_public: sanitizeText(input.phonePublic || input.phone_public),
    website_url: sanitizeText(input.websiteUrl || input.website_url),
    price_tier: PUBLIC_PRICE_TIERS.has(priceTier) ? priceTier : "$$",
    rating: nullableNumber(input.rating, 0, 5),
    review_count: Math.round(
      nullableNumber(input.reviewCount ?? input.review_count, 0, 1000000) || 0
    ),
    latitude: nullableNumber(input.latitude, -90, 90),
    longitude: nullableNumber(input.longitude, -180, 180),
    featured: Boolean(input.featured),
    published_at:
      status === "published"
        ? new Date().toISOString()
        : input.publishedAt || null,
    updated_at: new Date().toISOString(),
  };
}

function publicProfileI18nPayloads(providerId, input, parsed) {
  const rawRows = Array.isArray(input.i18n) ? input.i18n : [];
  const fallbackRows = [
    {
      locale: "ko",
      name: parsed.nameDisplayKo,
      summary: "",
      description: "",
      address: parsed.address,
      specialties: [],
      highlights: [],
    },
    {
      locale: "en",
      name: parsed.nameDisplayEn || parsed.nameDisplayKo,
      summary: "",
      description: "",
      address: parsed.address,
      specialties: [],
      highlights: [],
    },
  ];
  const rows = rawRows.length ? rawRows : fallbackRows;
  const byLocale = new Map();

  for (const row of rows) {
    const locale = cleanPublicLocale(row.locale);
    const name = sanitizeText(row.name);
    if (!name) continue;
    byLocale.set(locale, {
      provider_id: providerId,
      locale,
      name,
      summary: sanitizeText(row.summary),
      description: String(row.description || "").trim(),
      address: sanitizeText(row.address || parsed.address),
      specialties: cleanStringArray(row.specialties, 12),
      highlights: cleanStringArray(row.highlights, 12),
      meta_title: sanitizeText(row.metaTitle || row.meta_title),
      meta_description: sanitizeText(
        row.metaDescription || row.meta_description
      ),
      updated_at: new Date().toISOString(),
    });
  }

  return Array.from(byLocale.values());
}

function publicMediaPayloads(providerId, input) {
  const rows = Array.isArray(input.media) ? input.media : [];
  return rows
    .map((row, index) => {
      const mediaType = sanitizeText(
        row.mediaType || row.media_type,
        "gallery"
      ).toLowerCase();
      const publicUrl = sanitizeText(row.publicUrl || row.public_url);
      const storagePath = sanitizeText(row.storagePath || row.storage_path);
      if (!publicUrl && !storagePath) return null;
      return {
        provider_id: providerId,
        media_type:
          mediaType === "cover" || mediaType === "doctor"
            ? mediaType
            : "gallery",
        storage_path: storagePath || null,
        public_url: publicUrl || null,
        alt_text: sanitizeText(row.altText || row.alt_text),
        display_order: Number.isFinite(
          Number(row.displayOrder ?? row.display_order)
        )
          ? Number(row.displayOrder ?? row.display_order)
          : index,
        active: row.active !== false,
      };
    })
    .filter(Boolean);
}

function publicDoctorPayloads(providerId, input) {
  const rows = Array.isArray(input.doctors) ? input.doctors : [];
  return rows
    .map((row, index) => {
      const name = sanitizeText(row.name);
      if (!name) return null;
      return {
        provider_id: providerId,
        name,
        title: sanitizeText(row.title),
        specialty: sanitizeText(row.specialty),
        bio: String(row.bio || "").trim(),
        photo_url: sanitizeText(row.photoUrl || row.photo_url),
        years_experience: nullableNumber(
          row.yearsExperience ?? row.years_experience,
          0,
          80
        ),
        display_order: Number.isFinite(
          Number(row.displayOrder ?? row.display_order)
        )
          ? Number(row.displayOrder ?? row.display_order)
          : index,
        active: row.active !== false,
      };
    })
    .filter(Boolean);
}

function publicTreatmentPayloads(providerId, input) {
  const rows = Array.isArray(input.treatments) ? input.treatments : [];
  return rows
    .map(row => {
      const title = sanitizeText(row.title);
      if (!title) return null;
      return {
        provider_id: providerId,
        treatment_slug: sanitizeText(row.treatmentSlug || row.treatment_slug),
        title,
        price_min_krw: nullableNumber(row.priceMinKrw ?? row.price_min_krw, 0),
        price_max_krw: nullableNumber(row.priceMaxKrw ?? row.price_max_krw, 0),
        recovery_days: nullableNumber(row.recoveryDays ?? row.recovery_days, 0),
        duration_minutes: nullableNumber(
          row.durationMinutes ?? row.duration_minutes,
          0
        ),
        notes: String(row.notes || "").trim(),
        active: row.active !== false,
      };
    })
    .filter(Boolean);
}

async function replaceProviderPublicRows(config, table, providerId, rows) {
  await supabaseFetch(config, `${table}?provider_id=eq.${providerId}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
  if (!rows.length) return;
  await supabaseFetch(config, table, {
    method: "POST",
    body: JSON.stringify(rows),
    prefer: "return=minimal",
  });
}

async function upsertProviderPublicCms(
  config,
  providerId,
  publicProfile,
  parsed
) {
  if (!publicProfile) return;

  await supabaseFetch(
    config,
    "provider_public_profiles?on_conflict=provider_id",
    {
      method: "POST",
      body: JSON.stringify(
        publicProfileBasePayload(providerId, publicProfile, parsed)
      ),
      prefer: "resolution=merge-duplicates,return=minimal",
    }
  );

  const i18nRows = publicProfileI18nPayloads(providerId, publicProfile, parsed);
  if (i18nRows.length) {
    await supabaseFetch(
      config,
      "provider_public_profile_i18n?on_conflict=provider_id,locale",
      {
        method: "POST",
        body: JSON.stringify(i18nRows),
        prefer: "resolution=merge-duplicates,return=minimal",
      }
    );
  }

  await replaceProviderPublicRows(
    config,
    "provider_public_media",
    providerId,
    publicMediaPayloads(providerId, publicProfile)
  );
  await replaceProviderPublicRows(
    config,
    "provider_public_doctors",
    providerId,
    publicDoctorPayloads(providerId, publicProfile)
  );
  await replaceProviderPublicRows(
    config,
    "provider_public_treatments",
    providerId,
    publicTreatmentPayloads(providerId, publicProfile)
  );
}

async function syncRegistryOpsAccess(
  config,
  { role, partnerId = null, providerId = null, email, label }
) {
  const filter =
    role === "partner"
      ? `role=eq.partner&partner_id=eq.${partnerId}`
      : `role=eq.provider&provider_id=eq.${providerId}`;
  const existingRows = await safeList(
    config,
    "ops_user_access",
    `select=id,email&${filter}&active=eq.true`
  );
  const normalizedEmail = sanitizeText(email).toLowerCase();

  for (const row of existingRows) {
    if (
      !normalizedEmail ||
      String(row.email || "").toLowerCase() !== normalizedEmail
    ) {
      await supabaseFetch(config, `ops_user_access?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          active: false,
          updated_at: new Date().toISOString(),
        }),
        prefer: "return=minimal",
      });
    }
  }

  if (!normalizedEmail) return;

  await supabaseFetch(config, "ops_user_access?on_conflict=email", {
    method: "POST",
    body: JSON.stringify({
      email: normalizedEmail,
      role,
      partner_id: partnerId,
      provider_id: providerId,
      active: true,
      notes: `${role === "partner" ? "Partner" : "Provider"} access synced from admin registry for ${label}.`,
      updated_at: new Date().toISOString(),
    }),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function createProviderRegistry(config, body) {
  const parsed = parseProviderRegistryInput(body);
  assertProviderRegistryInput(parsed);

  const providerRows = await supabaseFetch(config, "providers", {
    method: "POST",
    body: JSON.stringify(providerRegistryBasePayload(parsed, false)),
    prefer: "return=representation",
  });
  const provider = providerRows?.[0];
  if (!provider?.id) throw new HttpError(409, "Provider could not be created.");

  await supabaseFetch(
    config,
    "provider_operating_profiles?on_conflict=provider_id",
    {
      method: "POST",
      body: JSON.stringify(providerRegistryProfilePayload(provider.id, parsed)),
      prefer: "resolution=merge-duplicates,return=minimal",
    }
  );
  await syncRegistryOpsAccess(config, {
    role: "provider",
    providerId: provider.id,
    email: parsed.opsEmail,
    label: parsed.nameLegal,
  });
  await upsertProviderPublicCms(
    config,
    provider.id,
    parsed.input.publicProfile || parsed.input.public_profile,
    parsed
  );

  return { ok: true, providerId: provider.id };
}

async function updateProvider(config, body) {
  const providerId = sanitizeText(
    body.providerId || body.id || body.provider?.id
  );
  if (!isUuid(providerId))
    throw new HttpError(400, "A valid providerId is required.");

  const parsed = parseProviderRegistryInput(body);
  assertProviderRegistryInput(parsed);

  const providerRows = await supabaseFetch(
    config,
    `providers?id=eq.${providerId}`,
    {
      method: "PATCH",
      body: JSON.stringify(providerRegistryBasePayload(parsed)),
      prefer: "return=representation",
    }
  );
  const provider = providerRows?.[0];
  if (!provider?.id) throw new HttpError(404, "Provider not found.");

  await supabaseFetch(
    config,
    "provider_operating_profiles?on_conflict=provider_id",
    {
      method: "POST",
      body: JSON.stringify(providerRegistryProfilePayload(provider.id, parsed)),
      prefer: "resolution=merge-duplicates,return=minimal",
    }
  );
  await syncRegistryOpsAccess(config, {
    role: "provider",
    providerId: provider.id,
    email: parsed.opsEmail,
    label: parsed.nameLegal,
  });
  await upsertProviderPublicCms(
    config,
    provider.id,
    parsed.input.publicProfile || parsed.input.public_profile,
    parsed
  );

  return { ok: true, providerId: provider.id };
}

async function deleteProvider(config, body) {
  const providerId = sanitizeText(
    body.providerId || body.id || body.provider?.id
  );
  if (!isUuid(providerId))
    throw new HttpError(400, "A valid providerId is required.");

  const providerRows = await supabaseFetch(
    config,
    `providers?id=eq.${providerId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=representation",
    }
  );
  if (!providerRows?.[0]) throw new HttpError(404, "Provider not found.");

  await supabaseFetch(
    config,
    `provider_operating_profiles?provider_id=eq.${providerId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        public_exposure_status: "blocked",
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=minimal",
    }
  );
  await supabaseFetch(
    config,
    `partner_provider_relationships?provider_id=eq.${providerId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
        relationship_status: "inactive",
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=minimal",
    }
  );
  await supabaseFetch(config, `ops_user_access?provider_id=eq.${providerId}`, {
    method: "PATCH",
    body: JSON.stringify({
      active: false,
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });
  await supabaseFetch(
    config,
    `provider_public_profiles?provider_id=eq.${providerId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "paused",
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=minimal",
    }
  );

  return { ok: true, providerId };
}

function parsePartnerRegistryInput(body) {
  const input = body.partner || body;
  const name = sanitizeText(input.name);
  const partnerType = sanitizeText(
    input.partnerType || input.partner_type,
    "agency"
  ).toLowerCase();
  const contactEmail = sanitizeText(
    input.contactEmail || input.contact_email
  ).toLowerCase();
  const opsEmail = sanitizeText(
    input.opsEmail || input.ops_email || contactEmail
  ).toLowerCase();
  const contactPhone = sanitizeText(input.contactPhone || input.contact_phone);
  const preferredProviderIds = Array.isArray(
    input.preferredProviderIds || input.preferred_provider_ids
  )
    ? (input.preferredProviderIds || input.preferred_provider_ids)
        .map(item => sanitizeText(item))
        .filter(Boolean)
    : [];
  const services = cleanTextArray(input.services, 12);

  return {
    input,
    name,
    partnerType,
    contactEmail,
    opsEmail,
    contactPhone,
    preferredProviderIds,
    services,
  };
}

function assertPartnerRegistryInput(parsed) {
  if (!parsed.name) throw new HttpError(400, "Partner name is required.");
  if (!PARTNER_TYPES.has(parsed.partnerType))
    throw new HttpError(400, "Unsupported partner type.");
  for (const providerId of parsed.preferredProviderIds) {
    if (!isUuid(providerId))
      throw new HttpError(400, "Preferred provider IDs must be valid UUIDs.");
  }
}

function partnerRegistryBasePayload(parsed, includeUpdatedAt = true) {
  return {
    name: parsed.name,
    partner_type: parsed.partnerType,
    contact_email: parsed.contactEmail || null,
    contact_phone: parsed.contactPhone || null,
    default_revenue_share_rate: numberInRange(
      parsed.input.defaultRevenueShareRate ??
        parsed.input.default_revenue_share_rate,
      0,
      0,
      1
    ),
    active: parsed.input.active !== false,
    ...(includeUpdatedAt ? { updated_at: new Date().toISOString() } : {}),
  };
}

async function syncPartnerRegistryRelationships(config, partnerId, parsed) {
  await supabaseFetch(
    config,
    `partner_provider_relationships?partner_id=eq.${partnerId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
        relationship_status: "inactive",
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=minimal",
    }
  );

  if (!parsed.preferredProviderIds.length) return;

  await supabaseFetch(
    config,
    "partner_provider_relationships?on_conflict=partner_id,provider_id",
    {
      method: "POST",
      body: JSON.stringify(
        parsed.preferredProviderIds.map(providerId => ({
          partner_id: partnerId,
          provider_id: providerId,
          relationship_status: "preferred",
          allowed_services: parsed.services,
          notes: sanitizeText(parsed.input.notes || parsed.input.sourceNotes),
          active: true,
          updated_at: new Date().toISOString(),
        }))
      ),
      prefer: "resolution=merge-duplicates,return=minimal",
    }
  );
}

async function createPartnerRegistry(config, body) {
  const parsed = parsePartnerRegistryInput(body);
  assertPartnerRegistryInput(parsed);

  const partnerRows = await supabaseFetch(config, "partners", {
    method: "POST",
    body: JSON.stringify(partnerRegistryBasePayload(parsed, false)),
    prefer: "return=representation",
  });
  const partner = partnerRows?.[0];
  if (!partner?.id) throw new HttpError(409, "Partner could not be created.");

  await syncPartnerRegistryRelationships(config, partner.id, parsed);
  await syncRegistryOpsAccess(config, {
    role: "partner",
    partnerId: partner.id,
    email: parsed.opsEmail,
    label: parsed.name,
  });

  return { ok: true, partnerId: partner.id };
}

async function updatePartner(config, body) {
  const partnerId = sanitizeText(body.partnerId || body.id || body.partner?.id);
  if (!isUuid(partnerId))
    throw new HttpError(400, "A valid partnerId is required.");

  const parsed = parsePartnerRegistryInput(body);
  assertPartnerRegistryInput(parsed);

  const partnerRows = await supabaseFetch(
    config,
    `partners?id=eq.${partnerId}`,
    {
      method: "PATCH",
      body: JSON.stringify(partnerRegistryBasePayload(parsed)),
      prefer: "return=representation",
    }
  );
  const partner = partnerRows?.[0];
  if (!partner?.id) throw new HttpError(404, "Partner not found.");

  await syncPartnerRegistryRelationships(config, partner.id, parsed);
  await syncRegistryOpsAccess(config, {
    role: "partner",
    partnerId: partner.id,
    email: parsed.opsEmail,
    label: parsed.name,
  });

  return { ok: true, partnerId: partner.id };
}

async function deletePartner(config, body) {
  const partnerId = sanitizeText(body.partnerId || body.id || body.partner?.id);
  if (!isUuid(partnerId))
    throw new HttpError(400, "A valid partnerId is required.");

  const partnerRows = await supabaseFetch(
    config,
    `partners?id=eq.${partnerId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=representation",
    }
  );
  if (!partnerRows?.[0]) throw new HttpError(404, "Partner not found.");

  await supabaseFetch(
    config,
    `partner_provider_relationships?partner_id=eq.${partnerId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
        relationship_status: "inactive",
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=minimal",
    }
  );
  await supabaseFetch(config, `ops_user_access?partner_id=eq.${partnerId}`, {
    method: "PATCH",
    body: JSON.stringify({
      active: false,
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });

  return { ok: true, partnerId };
}

async function upsertLandingRoute(config, body) {
  const route = body.route || body;
  const locale = sanitizeText(route.locale, "en").toLowerCase();
  const market = sanitizeText(route.market, "japan").toLowerCase();
  const status = sanitizeText(route.status, "draft").toLowerCase();
  const slug = normalizeSlug(route.slug);
  const title = sanitizeText(route.title);
  const intent = sanitizeText(route.intent);
  const sourceLocale = normalizeTranslationLocale(
    route.translationSourceLocale || route.translation_source_locale || locale,
    "ko"
  );
  const sourceCopy = {
    intent,
    title,
    subtitle: sanitizeText(route.subtitle),
    searchTheme: sanitizeText(route.searchTheme || route.search_theme),
    cta: sanitizeText(route.cta),
    secondaryCta: sanitizeText(route.secondaryCta || route.secondary_cta),
  };

  if (!LANDING_ROUTE_LOCALE_PATTERN.test(locale))
    throw new HttpError(400, "Unsupported landing route locale.");
  if (!LANDING_ROUTE_MARKET_PATTERN.test(market))
    throw new HttpError(400, "Unsupported landing route market.");
  if (!LANDING_ROUTE_STATUSES.has(status))
    throw new HttpError(400, "Unsupported landing route status.");
  if (!slug || !title || !intent)
    throw new HttpError(400, "slug, title, and intent are required.");

  let translations = mergeTranslations(
    cleanTranslations(route.translations, LANDING_TRANSLATION_FIELDS),
    { [sourceLocale]: sourceCopy }
  );
  let translationProvider = sanitizeText(
    route.translationProvider || route.translation_provider
  );
  let translatedAt = sanitizeText(route.translatedAt || route.translated_at);

  if (route.autoTranslate) {
    const generated = await translateAdminCopy({
      contentType: "landing_route",
      sourceLocale,
      targetLocales: cleanTranslationLocales(route.targetLocales, sourceLocale),
      fields: LANDING_TRANSLATION_FIELDS,
      sourceCopy,
    });
    translations = mergeTranslations(translations, generated);
    translationProvider = `openai:${openAiTranslationModel()}`;
    translatedAt = new Date().toISOString();
  }

  await supabaseFetch(config, "admin_landing_routes?on_conflict=locale,slug", {
    method: "POST",
    body: JSON.stringify({
      locale,
      slug,
      market,
      intent,
      title,
      subtitle: sourceCopy.subtitle,
      search_theme: sourceCopy.searchTheme,
      cta: sourceCopy.cta,
      secondary_cta: sourceCopy.secondaryCta,
      package_ids: cleanPackageIds(route.packageIds || route.package_ids),
      status,
      source: "admin",
      active: route.active !== false,
      published_at: status === "published" ? new Date().toISOString() : null,
      translations,
      translation_source_locale: sourceLocale,
      translation_provider: translationProvider || null,
      translated_at: translatedAt || null,
      updated_at: new Date().toISOString(),
    }),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function upsertPackageSku(config, body) {
  const input = body.packageSku || body.package_sku || body;
  const id = sanitizeText(input.id).toLowerCase();
  const shortTitle = sanitizeText(input.shortTitle || input.short_title);
  const market = sanitizeText(input.market, "global").toLowerCase();
  const category = sanitizeText(input.category, "skin").toLowerCase();
  const priceMinUsd = Math.round(
    numberInRange(input.priceMinUsd ?? input.price_min_usd, 0, 0, 999999)
  );
  const priceMaxUsd = Math.round(
    numberInRange(
      input.priceMaxUsd ?? input.price_max_usd,
      priceMinUsd,
      0,
      999999
    )
  );
  const durationDays = Math.round(
    numberInRange(input.durationDays ?? input.duration_days, 1, 1, 60)
  );
  const sourceLocale = normalizeTranslationLocale(
    input.translationSourceLocale || input.translation_source_locale || "ko",
    "ko"
  );
  const sourceCopy = {
    shortTitle,
    recoveryWindow: sanitizeText(input.recoveryWindow || input.recovery_window),
    bestFor: sanitizeText(input.bestFor || input.best_for),
    includes: cleanStringArray(input.includes, 16),
    complianceNote: sanitizeText(
      input.complianceNote || input.compliance_note
    ),
  };

  if (!PACKAGE_SKU_ID_PATTERN.test(id))
    throw new HttpError(
      400,
      "Package code must use lowercase letters, numbers, hyphens, or underscores."
    );
  if (!shortTitle) throw new HttpError(400, "Package short title is required.");
  if (!LANDING_ROUTE_MARKET_PATTERN.test(market))
    throw new HttpError(400, "Unsupported package market.");
  if (priceMaxUsd < priceMinUsd)
    throw new HttpError(
      400,
      "Package max price must be greater than or equal to min price."
    );

  let translations = mergeTranslations(
    cleanTranslations(input.translations, PACKAGE_TRANSLATION_FIELDS),
    { [sourceLocale]: sourceCopy }
  );
  let translationProvider = sanitizeText(
    input.translationProvider || input.translation_provider
  );
  let translatedAt = sanitizeText(input.translatedAt || input.translated_at);

  if (input.autoTranslate) {
    const generated = await translateAdminCopy({
      contentType: "package_sku",
      sourceLocale,
      targetLocales: cleanTranslationLocales(input.targetLocales, sourceLocale),
      fields: PACKAGE_TRANSLATION_FIELDS,
      sourceCopy,
    });
    translations = mergeTranslations(translations, generated);
    translationProvider = `openai:${openAiTranslationModel()}`;
    translatedAt = new Date().toISOString();
  }

  await supabaseFetch(config, "admin_package_skus?on_conflict=id", {
    method: "POST",
    body: JSON.stringify({
      id,
      short_title: shortTitle,
      market,
      category: category || "skin",
      price_min_usd: priceMinUsd,
      price_max_usd: priceMaxUsd,
      duration_days: durationDays,
      recovery_window: sourceCopy.recoveryWindow,
      coordinator_languages: cleanTextArray(
        input.coordinatorLanguages || input.coordinator_languages
      ),
      best_for: sourceCopy.bestFor,
      includes: sourceCopy.includes,
      compliance_note: sourceCopy.complianceNote,
      source: "admin",
      active: input.active !== false,
      translations,
      translation_source_locale: sourceLocale,
      translation_provider: translationProvider || null,
      translated_at: translatedAt || null,
      updated_at: new Date().toISOString(),
    }),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function deletePackageSku(config, body) {
  const packageId = sanitizeText(body.packageId || body.id).toLowerCase();
  if (!PACKAGE_SKU_ID_PATTERN.test(packageId))
    throw new HttpError(400, "A valid package code is required.");

  await supabaseFetch(config, "admin_package_skus?on_conflict=id", {
    method: "POST",
    body: JSON.stringify({
      id: packageId,
      short_title: packageId,
      market: "global",
      category: "skin",
      price_min_usd: 0,
      price_max_usd: 0,
      duration_days: 1,
      recovery_window: "",
      coordinator_languages: [],
      best_for: "",
      includes: [],
      compliance_note: "",
      source: "admin",
      active: false,
      updated_at: new Date().toISOString(),
    }),
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function assignPartner(config, body) {
  const { caseId, partnerId } = body;
  if (!isUuid(caseId)) throw new Error("A valid caseId is required.");

  await supabaseFetch(
    config,
    `case_partner_assignments?case_id=eq.${caseId}&status=in.(assigned,accepted)`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "removed",
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=minimal",
    }
  );

  if (partnerId) {
    if (!isUuid(partnerId)) throw new Error("A valid partnerId is required.");
    await supabaseFetch(
      config,
      "case_partner_assignments?on_conflict=case_id,partner_id,assignment_role",
      {
        method: "POST",
        body: JSON.stringify({
          case_id: caseId,
          partner_id: partnerId,
          assignment_role: "primary_agency",
          status: "assigned",
          consent_scope: { partner_safe_summary: true },
        }),
        prefer: "resolution=merge-duplicates,return=minimal",
      }
    );
  }

  await supabaseFetch(config, `partner_service_requests?case_id=eq.${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: partnerId ? "assigned" : "reviewing",
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });

  await logActivity(config, {
    caseId,
    eventType: partnerId ? "partner_assigned" : "partner_removed",
    eventPayload: { partner_id: partnerId || null },
  });
}

async function advanceCaseStatus(config, body) {
  const { caseId, status } = body;
  if (!isUuid(caseId)) throw new Error("A valid caseId is required.");
  if (!CASE_STATUSES.has(status))
    throw new Error("A valid case status is required.");

  const existing = await list(
    config,
    "cases",
    `select=id,status&id=eq.${caseId}&limit=1`
  );
  const currentCase = existing[0];
  if (!currentCase) throw new Error("Case not found.");

  if (currentCase.status !== status) {
    await supabaseFetch(config, `cases?id=eq.${caseId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      prefer: "return=minimal",
    });

    await logActivity(config, {
      caseId,
      eventType: "case_status_changed",
      eventPayload: { from_status: currentCase.status, to_status: status },
    });
  }
}

async function setShortlist(config, body) {
  const { caseId, partnerId, providerIds = [] } = body;
  if (!isUuid(caseId) || !isUuid(partnerId))
    throw new Error("Valid caseId and partnerId are required.");
  if (
    config.role === "partner" &&
    config.partnerId &&
    partnerId !== config.partnerId
  ) {
    throw new HttpError(
      403,
      "This partner account can only update its own cases."
    );
  }

  const cleanProviderIds = providerIds.filter(isUuid);
  if (cleanProviderIds.length !== providerIds.length)
    throw new Error("Every providerId must be a valid UUID.");

  const existing = await list(
    config,
    "partner_provider_shortlists",
    `select=id,provider_id&case_id=eq.${caseId}&partner_id=eq.${partnerId}`
  );

  const selected = new Set(cleanProviderIds);
  await Promise.all(
    existing
      .filter(row => !selected.has(row.provider_id))
      .map(row =>
        supabaseFetch(config, `partner_provider_shortlists?id=eq.${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            selection_status: "excluded",
            quote_request_ready: false,
            updated_at: new Date().toISOString(),
          }),
          prefer: "return=minimal",
        })
      )
  );

  if (cleanProviderIds.length) {
    await supabaseFetch(
      config,
      "partner_provider_shortlists?on_conflict=case_id,partner_id,provider_id",
      {
        method: "POST",
        body: JSON.stringify(
          cleanProviderIds.map((providerId, index) => ({
            case_id: caseId,
            partner_id: partnerId,
            provider_id: providerId,
            rank: index + 1,
            selection_status: "shortlisted",
            quote_request_ready: false,
          }))
        ),
        prefer: "resolution=merge-duplicates,return=minimal",
      }
    );
  }

  await logActivity(config, {
    caseId,
    actorRole: "partner",
    actorLabel: "Partner operator",
    eventType: "partner_shortlist_updated",
    eventPayload: { partner_id: partnerId, provider_ids: cleanProviderIds },
  });
}

async function requestQuotes(config, body) {
  const { caseId, partnerId, providerIds = [] } = body;
  if (!isUuid(caseId) || !isUuid(partnerId))
    throw new Error("Valid caseId and partnerId are required.");
  const cleanProviderIds = providerIds.filter(isUuid);
  if (!cleanProviderIds.length)
    throw new Error("At least one providerId is required.");
  if (cleanProviderIds.length !== providerIds.length)
    throw new Error("Every providerId must be a valid UUID.");

  await setShortlist(config, {
    caseId,
    partnerId,
    providerIds: cleanProviderIds,
  });

  await supabaseFetch(
    config,
    `partner_provider_shortlists?case_id=eq.${caseId}&partner_id=eq.${partnerId}&provider_id=${inFilter(cleanProviderIds)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        selection_status: "quote_requested",
        quote_request_ready: true,
        updated_at: new Date().toISOString(),
      }),
      prefer: "return=minimal",
    }
  );

  const existing = await list(
    config,
    "quote_requests",
    `select=provider_id&case_id=eq.${caseId}&provider_id=${inFilter(cleanProviderIds)}`
  );
  const existingProviders = new Set(existing.map(row => row.provider_id));
  const toInsert = cleanProviderIds.filter(
    providerId => !existingProviders.has(providerId)
  );

  if (toInsert.length) {
    await supabaseFetch(config, "quote_requests", {
      method: "POST",
      body: JSON.stringify(
        toInsert.map(providerId => ({
          case_id: caseId,
          provider_id: providerId,
          status: "requested",
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          notes: "Requested from partner-assisted shortlist.",
        }))
      ),
      prefer: "return=minimal",
    });
  }

  await supabaseFetch(config, `cases?id=eq.${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "quote_requested",
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });

  await logActivity(config, {
    caseId,
    eventType: "quote_requested",
    eventPayload: { partner_id: partnerId, provider_ids: cleanProviderIds },
  });
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function submitProviderQuote(config, body) {
  const {
    quoteRequestId,
    caseId,
    providerId,
    medicalFee,
    nonmedicalFee = 0,
    currency = "USD",
    commissionRate = 0.15,
    depositAmount = 0,
    validUntil,
    notes,
  } = body;

  if (!isUuid(quoteRequestId) || !isUuid(caseId) || !isUuid(providerId)) {
    throw new Error(
      "Valid quoteRequestId, caseId, and providerId are required."
    );
  }
  if (
    config.role === "provider" &&
    config.providerId &&
    providerId !== config.providerId
  ) {
    throw new HttpError(
      403,
      "This provider account can only submit its own quotes."
    );
  }

  const providerRows = await list(
    config,
    "providers",
    `select=id,default_commission_cap_rate&id=eq.${providerId}&limit=1`
  );
  const provider = providerRows[0];
  if (!provider) throw new Error("Provider not found.");

  const medical = numberOrDefault(medicalFee, -1);
  const nonmedical = numberOrDefault(nonmedicalFee, 0);
  const commission = numberOrDefault(commissionRate, 0.15);
  const deposit = numberOrDefault(depositAmount, 0);
  const capRate = Number(provider.default_commission_cap_rate || 0.3);

  if (medical < 0 || nonmedical < 0 || deposit < 0)
    throw new Error("Fees and deposit must be zero or greater.");
  if (deposit > medical + nonmedical)
    throw new Error("Deposit cannot exceed the total quote amount.");
  if (commission < 0 || commission > capRate)
    throw new Error("Commission rate exceeds the provider cap.");

  const quoteRows = await supabaseFetch(config, "quotes", {
    method: "POST",
    body: JSON.stringify({
      quote_request_id: quoteRequestId,
      case_id: caseId,
      provider_id: providerId,
      medical_fee: medical,
      nonmedical_fee: nonmedical,
      currency: String(currency).slice(0, 3).toUpperCase(),
      commission_rate: commission,
      commission_cap_rate: capRate,
      deposit_amount: deposit,
      valid_until:
        validUntil ||
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: "sent",
      notes: notes || "Provider quote submitted through Phase 2 quote desk.",
      sent_at: new Date().toISOString(),
    }),
    prefer: "return=representation",
  });

  const quote = Array.isArray(quoteRows) ? quoteRows[0] : null;

  await supabaseFetch(config, `quote_requests?id=eq.${quoteRequestId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "responded",
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });

  await supabaseFetch(config, `cases?id=eq.${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "quote_sent",
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });

  if (quote?.id) {
    await supabaseFetch(config, "commission_checks", {
      method: "POST",
      body: JSON.stringify({
        quote_id: quote.id,
        case_id: caseId,
        provider_id: providerId,
        requested_rate: commission,
        cap_rate: capRate,
        passed: true,
      }),
      prefer: "return=minimal",
    });
  }

  await logActivity(config, {
    caseId,
    actorRole: "provider",
    actorLabel: "Provider quote desk",
    eventType: "provider_quote_submitted",
    eventPayload: {
      quote_request_id: quoteRequestId,
      provider_id: providerId,
      quote_id: quote?.id,
      medical_fee: medical,
      nonmedical_fee: nonmedical,
      currency: String(currency).slice(0, 3).toUpperCase(),
    },
  });
}

function sanitizeText(value, fallback = "") {
  return String(value || fallback)
    .trim()
    .slice(0, 400);
}

function sanitizeTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

async function tryStoreNotification(config, event) {
  try {
    await supabaseFetch(config, "notification_outbox", {
      method: "POST",
      body: JSON.stringify({
        id: event.id,
        case_id: event.caseId,
        quote_id: event.quoteId || null,
        booking_id: event.bookingId || null,
        channel: event.channel,
        recipient: event.recipient,
        template: event.template,
        status: event.status,
        payload: event.payload,
        dispatch_result: event.dispatchResult,
        send_after: event.sendAfter,
        delivery_key: event.deliveryKey || null,
        created_at: event.createdAt,
      }),
      prefer: "return=minimal",
      timeoutMs: ACTIVITY_LOG_TIMEOUT_MS,
    });
    return "notification_outbox";
  } catch (error) {
    try {
      await supabaseFetch(config, "notification_outbox", {
        method: "POST",
        body: JSON.stringify({
          id: event.id,
          case_id: event.caseId,
          quote_id: event.quoteId || null,
          channel: event.channel,
          recipient: event.recipient,
          template: event.template,
          status: event.status,
          payload: event.payload,
          dispatch_result: event.dispatchResult,
          created_at: event.createdAt,
        }),
        prefer: "return=minimal",
        timeoutMs: ACTIVITY_LOG_TIMEOUT_MS,
      });
      return "notification_outbox";
    } catch (fallbackError) {
      console.warn(
        "Optional notification outbox insert skipped.",
        fallbackError
      );
      return "case_activity_events";
    }
  }
}

async function dispatchNotification(event) {
  if (Date.parse(event.sendAfter) > Date.now()) {
    return {
      status: "queued",
      result: { gateway: "scheduled", send_after: event.sendAfter },
    };
  }

  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) {
    return { status: "queued", result: { gateway: "not_configured" } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    EXTERNAL_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        status: "failed",
        result: {
          gateway: "webhook",
          status: response.status,
          message: text.slice(0, 300),
        },
      };
    }
    return {
      status: "sent",
      result: {
        gateway: "webhook",
        status: response.status,
        response: text.slice(0, 300),
      },
    };
  } catch (error) {
    return {
      status: "failed",
      result: {
        gateway: "webhook",
        message:
          error instanceof Error ? error.message : "Webhook dispatch failed.",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function queueNotification(config, body) {
  const caseId = sanitizeText(body.caseId);
  if (!caseId) throw new HttpError(400, "caseId is required.");

  const event = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    caseId,
    quoteId: sanitizeText(body.quoteId),
    bookingId: sanitizeText(body.bookingId),
    channel: sanitizeText(body.channel, "email"),
    recipient: sanitizeText(body.recipient, "case_contact"),
    template: sanitizeText(body.template, "quote_ready"),
    sendAfter: sanitizeTimestamp(body.sendAfter) || new Date().toISOString(),
    deliveryKey: sanitizeText(body.deliveryKey),
    status: "queued",
    payload:
      body.payload && typeof body.payload === "object" ? body.payload : {},
    dispatchResult: {},
    createdAt: new Date().toISOString(),
  };

  const dispatch = await dispatchNotification(event);
  event.status = dispatch.status;
  event.dispatchResult = dispatch.result;
  const storage = await tryStoreNotification(config, event);

  await logActivity(config, {
    caseId,
    actorRole: config.role,
    actorLabel: "Operations notification",
    eventType:
      dispatch.status === "sent" ? "notification_sent" : "notification_queued",
    eventPayload: {
      notification_id: event.id,
      quote_id: event.quoteId || null,
      channel: event.channel,
      template: event.template,
      status: event.status,
      storage,
    },
  });

  return {
    ok: true,
    notificationId: event.id,
    status: event.status,
    storage,
    dispatchResult: event.dispatchResult,
  };
}

function appBaseUrl(req) {
  const configured =
    process.env.APP_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured) {
    return configured.startsWith("http")
      ? configured.replace(/\/$/, "")
      : `https://${configured.replace(/\/$/, "")}`;
  }

  const proto = getHeader(req, "x-forwarded-proto") || "https";
  const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host");
  return `${proto}://${host}`;
}

async function createDepositCheckout(config, req, body) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey)
    throw new HttpError(503, "STRIPE_SECRET_KEY is not configured.");

  const caseId = sanitizeText(body.caseId);
  const quoteId = sanitizeText(body.quoteId);
  const providerId = sanitizeText(body.providerId);
  const depositAmountUsd = numberOrDefault(
    body.depositAmountUsd ?? body.depositAmount,
    -1
  );
  const unitAmount = Math.round(depositAmountUsd * 100);

  if (!caseId || !quoteId)
    throw new HttpError(400, "caseId and quoteId are required.");
  if (!Number.isFinite(unitAmount) || unitAmount <= 0)
    throw new HttpError(400, "A valid deposit amount is required.");

  const baseUrl = appBaseUrl(req);
  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("client_reference_id", quoteId);
  params.append(
    "success_url",
    `${baseUrl}/admin/quote-booking?deposit=success&session_id={CHECKOUT_SESSION_ID}`
  );
  params.append(
    "cancel_url",
    `${baseUrl}/admin/quote-booking?deposit=cancelled`
  );
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", "usd");
  params.append("line_items[0][price_data][unit_amount]", String(unitAmount));
  params.append(
    "line_items[0][price_data][product_data][name]",
    `GCL deposit ${quoteId}`
  );
  params.append(
    "line_items[0][price_data][product_data][description]",
    "Patient deposit for provider quote and booking coordination."
  );
  params.append("metadata[case_id]", caseId);
  params.append("metadata[quote_id]", quoteId);
  if (providerId) params.append("metadata[provider_id]", providerId);

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    EXTERNAL_REQUEST_TIMEOUT_MS
  );

  let response;
  try {
    response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new HttpError(
      response.status,
      payload?.error?.message || "Stripe Checkout session could not be created."
    );
  }

  await logActivity(config, {
    caseId,
    actorRole: config.role,
    actorLabel: "Stripe checkout",
    eventType: "deposit_checkout_created",
    eventPayload: {
      quote_id: quoteId,
      provider_id: providerId || null,
      session_id: payload.id,
      deposit_amount_usd: depositAmountUsd,
      payment_mode: paymentMode(),
    },
  });

  return {
    ok: true,
    checkoutUrl: payload.url,
    sessionId: payload.id,
    paymentMode: paymentMode(),
  };
}

const SLOT_STATUSES = new Set(["available", "held", "booked", "unavailable"]);
const VISIT_TYPES = new Set([
  "consultation",
  "procedure",
  "surgery",
  "checkup",
]);

function cleanLanguageSupport(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(item => sanitizeText(item).toLowerCase()).filter(Boolean))
  ).slice(0, 8);
}

function assertProviderAccess(config, providerId) {
  if (
    config.role === "provider" &&
    config.providerId &&
    providerId !== config.providerId
  ) {
    throw new HttpError(
      403,
      "This provider account can only manage its own slots."
    );
  }
}

async function readAvailabilitySlot(config, slotId) {
  if (!isUuid(slotId)) throw new HttpError(400, "A valid slotId is required.");
  const rows = await list(
    config,
    "availability_slots",
    `select=*&id=eq.${slotId}&limit=1`
  );
  const slot = rows[0];
  if (!slot) throw new HttpError(404, "Availability slot not found.");
  assertProviderAccess(config, slot.provider_id);
  return slot;
}

async function patchAvailabilitySlot(config, slotId, patch) {
  try {
    const rows = await supabaseFetch(
      config,
      `availability_slots?id=eq.${slotId}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
        prefer: "return=representation",
      }
    );
    if (!rows?.[0])
      throw new HttpError(409, "Availability slot could not be updated.");
    return rows[0];
  } catch (error) {
    const hasHoldColumns = "hold_case_id" in patch || "hold_quote_id" in patch;
    if (!hasHoldColumns) throw error;

    const { hold_case_id, hold_quote_id, ...compatiblePatch } = patch;
    const rows = await supabaseFetch(
      config,
      `availability_slots?id=eq.${slotId}`,
      {
        method: "PATCH",
        body: JSON.stringify(compatiblePatch),
        prefer: "return=representation",
      }
    );
    if (!rows?.[0])
      throw new HttpError(409, "Availability slot could not be updated.");
    return rows[0];
  }
}

async function createAvailabilitySlot(config, body) {
  const providerId = sanitizeText(body.providerId);
  const status = sanitizeText(body.status, "available").toLowerCase();
  const startsAt = sanitizeTimestamp(body.startsAt);
  const endsAt = sanitizeTimestamp(body.endsAt);

  if (!isUuid(providerId))
    throw new HttpError(400, "A valid providerId is required.");
  assertProviderAccess(config, providerId);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt))
    throw new HttpError(400, "A valid slot time range is required.");
  if (!SLOT_STATUSES.has(status))
    throw new HttpError(400, "A valid slot status is required.");

  const rows = await supabaseFetch(config, "availability_slots", {
    method: "POST",
    body: JSON.stringify({
      provider_id: providerId,
      starts_at: startsAt,
      ends_at: endsAt,
      status,
      language_support: cleanLanguageSupport(body.languageSupport),
    }),
    prefer: "return=representation",
  });

  return { ok: true, slot: normalizeAvailabilitySlot(rows[0]) };
}

async function holdAvailabilitySlot(config, body) {
  const slotId = sanitizeText(body.slotId);
  const caseId = sanitizeText(body.caseId);
  const quoteId = sanitizeText(body.quoteId);
  if (!isUuid(caseId)) throw new HttpError(400, "A valid caseId is required.");
  if (quoteId && !isUuid(quoteId))
    throw new HttpError(400, "quoteId must be a valid UUID.");

  const slot = await readAvailabilitySlot(config, slotId);
  const nowMs = Date.now();
  const heldExpired =
    slot.status === "held" &&
    slot.hold_expires_at &&
    Date.parse(slot.hold_expires_at) <= nowMs;
  if (slot.status === "booked" || slot.status === "unavailable")
    throw new HttpError(409, "This slot is not available.");
  if (slot.status === "held" && !heldExpired)
    throw new HttpError(409, "This slot is already temporarily held.");

  const holdMinutes = Math.max(
    5,
    Math.min(120, numberOrDefault(body.holdMinutes, 15))
  );
  const holdExpiresAt = new Date(nowMs + holdMinutes * 60 * 1000).toISOString();
  const updated = await patchAvailabilitySlot(config, slot.id, {
    status: "held",
    hold_expires_at: holdExpiresAt,
    hold_case_id: caseId,
    hold_quote_id: quoteId || null,
    updated_at: new Date().toISOString(),
  });

  const notification = await queueNotification(config, {
    caseId,
    quoteId,
    channel: sanitizeText(body.channel, "email"),
    recipient: sanitizeText(body.recipient, "case_contact"),
    template: "slot_hold_created",
    deliveryKey: `slot:${slot.id}:hold:${caseId}`,
    payload: {
      slot_id: slot.id,
      provider_id: slot.provider_id,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      hold_expires_at: holdExpiresAt,
    },
  });

  await logActivity(config, {
    caseId,
    eventType: "availability_slot_held",
    eventPayload: {
      slot_id: slot.id,
      quote_id: quoteId || null,
      provider_id: slot.provider_id,
      hold_expires_at: holdExpiresAt,
    },
  });

  return {
    ok: true,
    slot: normalizeAvailabilitySlot(updated),
    notifications: [notification],
  };
}

async function releaseAvailabilitySlot(config, body) {
  const slot = await readAvailabilitySlot(config, sanitizeText(body.slotId));
  const caseId = sanitizeText(body.caseId) || slot.hold_case_id || "";
  const quoteId = sanitizeText(body.quoteId) || slot.hold_quote_id || "";

  if (slot.status === "booked")
    throw new HttpError(
      409,
      "Booked slots cannot be released from the hold flow."
    );

  const updated = await patchAvailabilitySlot(config, slot.id, {
    status: "available",
    hold_expires_at: null,
    hold_case_id: null,
    hold_quote_id: null,
    updated_at: new Date().toISOString(),
  });

  await logActivity(config, {
    caseId,
    eventType: "availability_slot_released",
    eventPayload: {
      slot_id: slot.id,
      quote_id: quoteId || null,
      provider_id: slot.provider_id,
    },
  });

  return {
    ok: true,
    slot: normalizeAvailabilitySlot(updated),
    notifications: [],
  };
}

async function confirmHeldBooking(config, body) {
  const slot = await readAvailabilitySlot(config, sanitizeText(body.slotId));
  const caseId = sanitizeText(body.caseId);
  const quoteId = sanitizeText(body.quoteId);
  const visitType = sanitizeText(body.visitType, "procedure").toLowerCase();

  if (!isUuid(caseId) || !isUuid(quoteId))
    throw new HttpError(400, "Valid caseId and quoteId are required.");
  if (!VISIT_TYPES.has(visitType))
    throw new HttpError(400, "A valid visitType is required.");
  if (slot.status === "booked" || slot.status === "unavailable")
    throw new HttpError(409, "This slot cannot be booked.");
  if (
    slot.status === "held" &&
    slot.hold_expires_at &&
    Date.parse(slot.hold_expires_at) <= Date.now()
  ) {
    throw new HttpError(409, "The temporary hold has expired.");
  }

  const quoteRows = await list(
    config,
    "quotes",
    `select=id,case_id,provider_id&id=eq.${quoteId}&limit=1`
  );
  const quote = quoteRows[0];
  if (!quote) throw new HttpError(404, "Quote not found.");
  if (quote.case_id !== caseId || quote.provider_id !== slot.provider_id)
    throw new HttpError(
      409,
      "Quote, case, and provider do not match the selected slot."
    );

  const bookingRows = await supabaseFetch(
    config,
    "bookings?on_conflict=idempotency_key",
    {
      method: "POST",
      body: JSON.stringify({
        case_id: caseId,
        quote_id: quoteId,
        provider_id: slot.provider_id,
        scheduled_at: slot.starts_at,
        visit_type: visitType,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        idempotency_key: `slot:${slot.id}:case:${caseId}:quote:${quoteId}`,
      }),
      prefer: "resolution=merge-duplicates,return=representation",
    }
  );
  const booking = bookingRows[0];

  const updatedSlot = await patchAvailabilitySlot(config, slot.id, {
    status: "booked",
    hold_expires_at: null,
    hold_case_id: null,
    hold_quote_id: null,
    updated_at: new Date().toISOString(),
  });

  await supabaseFetch(config, `cases?id=eq.${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "booking_confirmed",
      updated_at: new Date().toISOString(),
    }),
    prefer: "return=minimal",
  });

  const notifications = [];
  notifications.push(
    await queueNotification(config, {
      caseId,
      quoteId,
      bookingId: booking.id,
      channel: sanitizeText(body.channel, "email"),
      recipient: sanitizeText(body.recipient, "case_contact"),
      template: "booking_confirmed_patient",
      deliveryKey: `booking:${booking.id}:confirmed:patient`,
      payload: {
        booking_id: booking.id,
        slot_id: slot.id,
        provider_id: slot.provider_id,
        scheduled_at: slot.starts_at,
        visit_type: visitType,
      },
    })
  );
  notifications.push(
    await queueNotification(config, {
      caseId,
      quoteId,
      bookingId: booking.id,
      channel: "email",
      recipient: "provider_ops",
      template: "booking_confirmed_provider",
      deliveryKey: `booking:${booking.id}:confirmed:provider`,
      payload: {
        booking_id: booking.id,
        slot_id: slot.id,
        provider_id: slot.provider_id,
        scheduled_at: slot.starts_at,
      },
    })
  );

  const reminderAt = new Date(
    Date.parse(slot.starts_at) - 24 * 60 * 60 * 1000
  ).toISOString();
  if (Date.parse(reminderAt) > Date.now()) {
    notifications.push(
      await queueNotification(config, {
        caseId,
        quoteId,
        bookingId: booking.id,
        channel: sanitizeText(body.channel, "email"),
        recipient: sanitizeText(body.recipient, "case_contact"),
        template: "booking_reminder_24h",
        sendAfter: reminderAt,
        deliveryKey: `booking:${booking.id}:reminder:24h`,
        payload: {
          booking_id: booking.id,
          slot_id: slot.id,
          provider_id: slot.provider_id,
          scheduled_at: slot.starts_at,
          send_after: reminderAt,
        },
      })
    );
  }

  await logActivity(config, {
    caseId,
    eventType: "booking_confirmed_from_slot",
    eventPayload: {
      slot_id: slot.id,
      booking_id: booking.id,
      quote_id: quoteId,
      provider_id: slot.provider_id,
    },
  });

  return {
    ok: true,
    slot: normalizeAvailabilitySlot(updatedSlot),
    booking: normalizeBooking(booking),
    notifications,
  };
}

function allowedRolesForAction(action) {
  if (action === "setShortlist") return ["admin", "partner"];
  if (action === "submitProviderQuote") return ["admin", "provider"];
  if (action === "createAvailabilitySlot") return ["admin", "provider"];
  if (
    action === "assignPartner" ||
    action === "advanceCaseStatus" ||
    action === "requestQuotes" ||
    action === "queueNotification" ||
    action === "createDepositCheckout" ||
    action === "holdAvailabilitySlot" ||
    action === "releaseAvailabilitySlot" ||
    action === "confirmHeldBooking" ||
    action === "upsertLandingRoute" ||
    action === "upsertPackageSku" ||
    action === "deletePackageSku" ||
    action === "createProvider" ||
    action === "updateProvider" ||
    action === "deleteProvider" ||
    action === "createPartner" ||
    action === "updatePartner" ||
    action === "deletePartner"
  ) {
    return ["admin"];
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const config = await requireConfig(req, ["admin", "partner", "provider"]);
      if (config.error)
        return json(res, config.status, { error: config.error });
      return json(res, 200, await getSnapshot(config));
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const allowedRoles = allowedRolesForAction(body.action);
      if (!allowedRoles)
        return json(res, 400, { error: "Unsupported action." });

      const config = await requireConfig(req, allowedRoles);
      if (config.error)
        return json(res, config.status, { error: config.error });

      if (body.action === "assignPartner") await assignPartner(config, body);
      else if (body.action === "advanceCaseStatus")
        await advanceCaseStatus(config, body);
      else if (body.action === "setShortlist") await setShortlist(config, body);
      else if (body.action === "requestQuotes")
        await requestQuotes(config, body);
      else if (body.action === "submitProviderQuote")
        await submitProviderQuote(config, body);
      else if (body.action === "queueNotification")
        return json(res, 200, await queueNotification(config, body));
      else if (body.action === "createDepositCheckout")
        return json(res, 200, await createDepositCheckout(config, req, body));
      else if (body.action === "createAvailabilitySlot")
        return json(res, 200, await createAvailabilitySlot(config, body));
      else if (body.action === "holdAvailabilitySlot")
        return json(res, 200, await holdAvailabilitySlot(config, body));
      else if (body.action === "releaseAvailabilitySlot")
        return json(res, 200, await releaseAvailabilitySlot(config, body));
      else if (body.action === "confirmHeldBooking")
        return json(res, 200, await confirmHeldBooking(config, body));
      else if (body.action === "upsertLandingRoute")
        await upsertLandingRoute(config, body);
      else if (body.action === "upsertPackageSku")
        await upsertPackageSku(config, body);
      else if (body.action === "deletePackageSku")
        await deletePackageSku(config, body);
      else if (body.action === "createProvider")
        await createProviderRegistry(config, body);
      else if (body.action === "updateProvider")
        await updateProvider(config, body);
      else if (body.action === "deleteProvider")
        await deleteProvider(config, body);
      else if (body.action === "createPartner")
        await createPartnerRegistry(config, body);
      else if (body.action === "updatePartner")
        await updatePartner(config, body);
      else if (body.action === "deletePartner")
        await deletePartner(config, body);

      return json(res, 200, await getSnapshot(config));
    }

    return json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return json(res, error?.status || 500, {
      error:
        error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}
