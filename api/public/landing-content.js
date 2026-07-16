const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
};
const SUPABASE_TIMEOUT_MS = 7000;
const LOCALE_ALIASES = {
  jp: "ja",
  "zh-cn": "zh",
  "zh-tw": "zh",
};

function json(res, status, payload) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(payload));
}

function normalizeLocale(locale) {
  const normalized = String(locale || "en").toLowerCase();
  return LOCALE_ALIASES[normalized] || normalized;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function inFilter(values) {
  return `in.(${values.map(value => encodeURIComponent(value)).join(",")})`;
}

async function supabaseFetch(config, path) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
      signal: controller.signal,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(body?.message || text || "Supabase request failed.");
    }
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
}

function pickLocalizedCopy(translations, locale) {
  const normalized = normalizeLocale(locale);
  return (
    translations?.[normalized] ||
    translations?.[locale] ||
    translations?.en ||
    translations?.ko ||
    null
  );
}

function pickRoute(rows, locale) {
  const normalized = normalizeLocale(locale);
  return (
    rows.find(row => normalizeLocale(row.locale) === normalized) ||
    rows.find(row => Boolean(pickLocalizedCopy(row.translations, normalized))) ||
    rows[0] ||
    null
  );
}

function normalizeRoute(row, locale) {
  const copy = pickLocalizedCopy(row.translations, locale) || {};
  return {
    id: row.id,
    locale,
    slug: row.slug,
    market: row.market,
    intent: copy.intent || row.intent || "",
    title: copy.title || row.title || "",
    subtitle: copy.subtitle || row.subtitle || "",
    searchTheme: copy.searchTheme || row.search_theme || "",
    cta: copy.cta || row.cta || "",
    secondaryCta: copy.secondaryCta || row.secondary_cta || "",
    packageIds: row.package_ids || [],
    translations: row.translations || {},
    translationSourceLocale: row.translation_source_locale || "ko",
    publishedAt: row.published_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizePackage(row, locale) {
  const copy = pickLocalizedCopy(row.translations, locale) || {};
  const shortTitle = copy.shortTitle || row.short_title || row.id;
  return {
    id: row.id,
    title: copy.title || shortTitle,
    shortTitle,
    market: row.market || "global",
    treatmentSlug: row.category || "skin",
    priceMinUsd: Number(row.price_min_usd || 0),
    priceMaxUsd: Number(row.price_max_usd || 0),
    durationDays: Number(row.duration_days || 1),
    recoveryWindow: copy.recoveryWindow || row.recovery_window || "",
    coordinatorLanguages: row.coordinator_languages || [],
    bestFor: copy.bestFor || row.best_for || "",
    includes: Array.isArray(copy.includes) ? copy.includes : row.includes || [],
    complianceNote: copy.complianceNote || row.compliance_note || "",
    translations: row.translations || {},
    translationSourceLocale: row.translation_source_locale || "ko",
  };
}

function readConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed." });
  }

  try {
    const config = readConfig();
    if (!config) return json(res, 404, { error: "Landing content unavailable." });

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const locale = normalizeLocale(url.searchParams.get("locale"));
    const slug = normalizeSlug(url.searchParams.get("slug"));
    if (!slug) return json(res, 400, { error: "slug is required." });

    const rows = await supabaseFetch(
      config,
      `admin_landing_routes?select=id,locale,slug,market,intent,title,subtitle,search_theme,cta,secondary_cta,package_ids,translations,translation_source_locale,published_at,updated_at&slug=eq.${encodeURIComponent(slug)}&active=eq.true&status=eq.published&limit=20`
    );
    const routeRow = pickRoute(rows || [], locale);
    if (!routeRow) return json(res, 404, { error: "Landing route not found." });

    const route = normalizeRoute(routeRow, locale);
    const packageIds = route.packageIds.filter(Boolean);
    const packages = packageIds.length
      ? await supabaseFetch(
          config,
          `admin_package_skus?select=id,short_title,market,category,price_min_usd,price_max_usd,duration_days,recovery_window,coordinator_languages,best_for,includes,compliance_note,translations,translation_source_locale&active=eq.true&id=${inFilter(packageIds)}`
        )
      : [];

    const packageMap = new Map(
      packages.map(row => [row.id, normalizePackage(row, locale)])
    );

    return json(res, 200, {
      route,
      packages: packageIds.map(id => packageMap.get(id)).filter(Boolean),
    });
  } catch (error) {
    return json(res, 500, {
      error:
        error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}
