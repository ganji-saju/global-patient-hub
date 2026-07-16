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
    if (!config) return json(res, 404, { error: "Package content unavailable." });

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const locale = normalizeLocale(url.searchParams.get("locale"));
    const limit = Math.max(
      1,
      Math.min(12, Number(url.searchParams.get("limit") || 3))
    );

    const routeRows = await supabaseFetch(
      config,
      "admin_landing_routes?select=package_ids&active=eq.true&status=eq.published&limit=120"
    );
    const packageIds = Array.from(
      new Set((routeRows || []).flatMap(row => row.package_ids || []))
    ).slice(0, 80);

    if (!packageIds.length) return json(res, 200, { packages: [] });

    const rows = await supabaseFetch(
      config,
      `admin_package_skus?select=id,short_title,market,category,price_min_usd,price_max_usd,duration_days,recovery_window,coordinator_languages,best_for,includes,compliance_note,translations,translation_source_locale&active=eq.true&id=${inFilter(packageIds)}`
    );
    const rowMap = new Map(rows.map(row => [row.id, row]));
    const packages = packageIds
      .map(id => rowMap.get(id))
      .filter(Boolean)
      .slice(0, limit)
      .map(row => normalizePackage(row, locale));

    return json(res, 200, { packages });
  } catch (error) {
    return json(res, 500, {
      error:
        error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
}
