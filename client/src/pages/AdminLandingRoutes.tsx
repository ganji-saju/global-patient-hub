import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Database,
  ExternalLink,
  FilePlus2,
  ListChecks,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SKIN_LANDING_PAGES, SKIN_PACKAGE_SKUS } from "@/lib/wedgeData";
import {
  LANDING_LOCALE_OPTIONS,
  LANDING_MARKET_OPTIONS,
  getDefaultMarketForLocale,
  type LandingLocale,
  type WedgeMarket,
} from "@/lib/landingRouteOptions";
import { languageLabel, marketLabel, statusLabel } from "@/lib/adminLabels";
import {
  fetchPartnerMvpSnapshot,
  deletePackageSkuMvp,
  readAdminApiToken,
  upsertPackageSkuMvp,
  upsertLandingRouteMvp,
  type LandingRouteStatus,
  type ManagedLandingRoute,
  type ManagedPackageSku,
} from "@/lib/partnerMvpApi";
import { cn } from "@/lib/utils";

const DEFAULT_TRANSLATION_TARGET_LOCALES = ["en", "ja", "zh", "ar"];

const defaultDraft: ManagedLandingRoute = {
  locale: "ko",
  slug: "",
  market: "global",
  intent: "",
  title: "",
  subtitle: "",
  searchTheme: "",
  cta: "",
  secondaryCta: "",
  packageIds: [],
  status: "draft",
  active: true,
  translationSourceLocale: "ko",
  autoTranslate: true,
  targetLocales: DEFAULT_TRANSLATION_TARGET_LOCALES,
};

const defaultPackageDraft: ManagedPackageSku = {
  id: "",
  shortTitle: "",
  market: "global",
  category: "skin",
  priceMinUsd: 0,
  priceMaxUsd: 0,
  durationDays: 1,
  recoveryWindow: "",
  coordinatorLanguages: ["en"],
  bestFor: "",
  includes: [],
  complianceNote: "",
  source: "admin",
  active: true,
  translationSourceLocale: "ko",
  autoTranslate: true,
  targetLocales: DEFAULT_TRANSLATION_TARGET_LOCALES,
};

const staticRoutes: ManagedLandingRoute[] = SKIN_LANDING_PAGES.map(page => ({
  ...page,
  status: "published",
  source: "code",
  active: true,
}));

const staticPackageSkus: ManagedPackageSku[] = SKIN_PACKAGE_SKUS.map(pkg => ({
  ...pkg,
  category: "skin",
  source: "code",
  active: true,
}));

const languageGroups = LANDING_MARKET_OPTIONS.map(market => ({
  market,
  languages: LANDING_LOCALE_OPTIONS.filter(
    option => option.defaultMarket === market.code
  ),
})).filter(group => group.languages.length);

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function routeKey(route: Pick<ManagedLandingRoute, "locale" | "slug">) {
  return `${route.locale}:${route.slug}`;
}

function mergeRoutes(
  remoteRoutes: ManagedLandingRoute[],
  localDrafts: ManagedLandingRoute[]
) {
  const merged = new Map<string, ManagedLandingRoute>();
  for (const route of staticRoutes) merged.set(routeKey(route), route);
  for (const route of remoteRoutes) merged.set(routeKey(route), route);
  for (const route of localDrafts) merged.set(routeKey(route), route);
  return Array.from(merged.values()).sort((a, b) =>
    `${a.locale}-${a.slug}`.localeCompare(`${b.locale}-${b.slug}`)
  );
}

function mergePackageSkus(
  remotePackages: ManagedPackageSku[],
  localPackages: ManagedPackageSku[]
) {
  const merged = new Map<string, ManagedPackageSku>();
  for (const pkg of staticPackageSkus) merged.set(pkg.id, pkg);
  for (const pkg of [...remotePackages, ...localPackages]) {
    if (pkg.active === false) merged.delete(pkg.id);
    else merged.set(pkg.id, { ...pkg, active: true });
  }
  return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function splitCommaList(value: string) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function splitLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeTranslationLocale(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "jp") return "ja";
  if (normalized === "zh-cn" || normalized === "zh-tw") return "zh";
  return normalized;
}

function splitLocaleList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map(normalizeTranslationLocale)
        .filter(Boolean)
    )
  );
}

function StatusBadge({ status }: { status: LandingRouteStatus }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-1 text-xs font-semibold",
        status === "published" && "border-teal-200 bg-teal-50 text-teal-800",
        status === "draft" && "border-amber-200 bg-amber-50 text-amber-800",
        status === "paused" && "border-ink-200 bg-ink-50 text-ink-700",
        status === "archived" && "border-rose-200 bg-rose-50 text-rose-800"
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export default function AdminLandingRoutes() {
  const [draft, setDraft] = useState<ManagedLandingRoute>(defaultDraft);
  const [packageDraft, setPackageDraft] =
    useState<ManagedPackageSku>(defaultPackageDraft);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = useState<ManagedLandingRoute[]>([]);
  const [remoteRoutes, setRemoteRoutes] = useState<ManagedLandingRoute[]>([]);
  const [localPackageSkus, setLocalPackageSkus] = useState<ManagedPackageSku[]>(
    []
  );
  const [remotePackageSkus, setRemotePackageSkus] = useState<
    ManagedPackageSku[]
  >([]);
  const [apiStatus, setApiStatus] = useState<
    "loading" | "live" | "static" | "saving" | "error"
  >("loading");
  const [apiMessage, setApiMessage] = useState(
    "Supabase 랜딩 경로 저장소를 확인 중입니다."
  );
  const [adminToken] = useState(() => readAdminApiToken());

  async function refreshRoutes(token = adminToken) {
    if (!token) {
      setApiStatus("static");
      setApiMessage(
        "이메일 인증 세션이 없어 코드에 포함된 기본 글로벌 route만 표시합니다."
      );
      return;
    }

    try {
      setApiStatus("loading");
      const snapshot = await fetchPartnerMvpSnapshot(token);
      setRemoteRoutes(snapshot.landingRoutes ?? []);
      setRemotePackageSkus(snapshot.packageSkus ?? []);
      const persistence = snapshot.meta?.adminPersistenceHealth;
      setApiStatus("live");
      setApiMessage(
        persistence?.ready
          ? "Supabase admin_landing_routes 저장소와 연결되었습니다."
          : "운영 API는 연결되었지만 admin persistence migration 적용 상태를 확인해야 합니다."
      );
    } catch (error) {
      setApiStatus("error");
      setApiMessage(
        error instanceof Error
          ? error.message
          : "랜딩 경로 저장소를 불러오지 못했습니다."
      );
    }
  }

  useEffect(() => {
    void refreshRoutes();
  }, []);

  const routes = useMemo(
    () => mergeRoutes(remoteRoutes, localDrafts),
    [remoteRoutes, localDrafts]
  );
  const packageCatalog = useMemo(
    () => mergePackageSkus(remotePackageSkus, localPackageSkus),
    [remotePackageSkus, localPackageSkus]
  );

  const localeCount = new Set(routes.map(route => route.locale)).size;
  const marketCount = new Set(routes.map(route => route.market)).size;
  const draftCount = routes.filter(route => route.status === "draft").length;
  const packageCount = packageCatalog.length;

  const updateDraft = <K extends keyof ManagedLandingRoute>(
    key: K,
    value: ManagedLandingRoute[K]
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const updatePackageDraft = <K extends keyof ManagedPackageSku>(
    key: K,
    value: ManagedPackageSku[K]
  ) => {
    setPackageDraft(current => ({ ...current, [key]: value }));
  };

  const updateLocale = (locale: LandingLocale) => {
    setDraft(current => ({
      ...current,
      locale,
      market: getDefaultMarketForLocale(locale),
      translationSourceLocale: normalizeTranslationLocale(locale),
    }));
  };

  const togglePackage = (packageId: string) => {
    setDraft(current => ({
      ...current,
      packageIds: current.packageIds.includes(packageId)
        ? current.packageIds.filter(id => id !== packageId)
        : [...current.packageIds, packageId],
    }));
  };

  const editPackage = (pkg: ManagedPackageSku) => {
    setEditingPackageId(pkg.id);
    setPackageDraft({ ...pkg, active: true });
  };

  const resetPackageDraft = () => {
    setEditingPackageId(null);
    setPackageDraft(defaultPackageDraft);
  };

  const submitPackageDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const packageId = packageDraft.id.trim().toLowerCase();
    const shortTitle = packageDraft.shortTitle.trim();
    if (!packageId || !shortTitle) {
      setApiStatus("error");
      setApiMessage("패키지 코드와 짧은 제목은 필수입니다.");
      return;
    }

    const nextPackage: ManagedPackageSku = {
      ...packageDraft,
      id: packageId,
      shortTitle,
      priceMinUsd: Math.max(0, Math.round(packageDraft.priceMinUsd || 0)),
      priceMaxUsd: Math.max(0, Math.round(packageDraft.priceMaxUsd || 0)),
      durationDays: Math.max(1, Math.round(packageDraft.durationDays || 1)),
      source: adminToken ? "admin" : "local",
      active: true,
    };

    if (nextPackage.priceMaxUsd < nextPackage.priceMinUsd) {
      setApiStatus("error");
      setApiMessage("패키지 최대 금액은 최소 금액보다 작을 수 없습니다.");
      return;
    }

    const replacePackageId = (oldId: string | null, newId: string) => {
      if (!oldId || oldId === newId) return;
      setDraft(current => ({
        ...current,
        packageIds: current.packageIds.map(id => (id === oldId ? newId : id)),
      }));
    };

    if (!adminToken) {
      setLocalPackageSkus(current => {
        const withoutEdited = current.filter(pkg => pkg.id !== nextPackage.id);
        const renamed =
          editingPackageId && editingPackageId !== nextPackage.id
            ? [
                ...withoutEdited.filter(pkg => pkg.id !== editingPackageId),
                {
                  ...nextPackage,
                  id: editingPackageId,
                  active: false,
                },
              ]
            : withoutEdited;
        return [...renamed, nextPackage];
      });
      replacePackageId(editingPackageId, nextPackage.id);
      resetPackageDraft();
      setApiStatus("static");
      setApiMessage("패키지 코드를 현재 브라우저 세션에만 반영했습니다.");
      return;
    }

    try {
      setApiStatus("saving");
      let snapshot = await upsertPackageSkuMvp(adminToken, nextPackage);
      if (editingPackageId && editingPackageId !== nextPackage.id) {
        snapshot = await deletePackageSkuMvp(adminToken, editingPackageId);
      }
      setRemoteRoutes(snapshot.landingRoutes ?? []);
      setRemotePackageSkus(snapshot.packageSkus ?? []);
      replacePackageId(editingPackageId, nextPackage.id);
      resetPackageDraft();
      setApiStatus("live");
      setApiMessage("패키지 코드를 저장했습니다.");
    } catch (error) {
      setApiStatus("error");
      setApiMessage(
        error instanceof Error
          ? error.message
          : "패키지 코드 저장에 실패했습니다."
      );
    }
  };

  const deletePackage = async (pkg: ManagedPackageSku) => {
    if (!window.confirm(`${pkg.id} 패키지 코드를 삭제할까요?`)) return;

    setDraft(current => ({
      ...current,
      packageIds: current.packageIds.filter(id => id !== pkg.id),
    }));

    if (!adminToken) {
      setLocalPackageSkus(current => [
        ...current.filter(item => item.id !== pkg.id),
        { ...pkg, active: false, source: "local" },
      ]);
      if (editingPackageId === pkg.id) resetPackageDraft();
      setApiStatus("static");
      setApiMessage("패키지 코드를 현재 브라우저 세션에서 숨겼습니다.");
      return;
    }

    try {
      setApiStatus("saving");
      const snapshot = await deletePackageSkuMvp(adminToken, pkg.id);
      setRemoteRoutes(snapshot.landingRoutes ?? []);
      setRemotePackageSkus(snapshot.packageSkus ?? []);
      if (editingPackageId === pkg.id) resetPackageDraft();
      setApiStatus("live");
      setApiMessage("패키지 코드를 삭제했습니다.");
    } catch (error) {
      setApiStatus("error");
      setApiMessage(
        error instanceof Error
          ? error.message
          : "패키지 코드 삭제에 실패했습니다."
      );
    }
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const slug = normalizeSlug(draft.slug);
    if (!slug || !draft.title.trim() || !draft.intent.trim()) {
      setApiStatus("error");
      setApiMessage("slug, 검색 의도, 제목은 필수입니다.");
      return;
    }

    const nextRoute: ManagedLandingRoute = {
      ...draft,
      slug,
      status: draft.status || "draft",
      source: adminToken ? "admin" : "local",
      active: true,
    };

    if (!adminToken) {
      setLocalDrafts(current => [
        ...current.filter(route => routeKey(route) !== routeKey(nextRoute)),
        nextRoute,
      ]);
      setDraft(defaultDraft);
      setApiStatus("static");
      setApiMessage(
        "이메일 인증 세션이 없어 현재 브라우저 세션에만 초안을 보관했습니다."
      );
      return;
    }

    try {
      setApiStatus("saving");
      const snapshot = await upsertLandingRouteMvp(adminToken, nextRoute);
      setRemoteRoutes(snapshot.landingRoutes ?? []);
      setLocalDrafts([]);
      setDraft(defaultDraft);
      setApiStatus("live");
      setApiMessage(
        "Supabase admin_landing_routes에 랜딩 초안을 저장했습니다."
      );
    } catch (error) {
      setApiStatus("error");
      setApiMessage(
        error instanceof Error
          ? error.message
          : "랜딩 초안 저장에 실패했습니다."
      );
    }
  };

  return (
    <Layout>
      <section className="border-b border-ink-200 bg-ink-50">
        <div className="container-wide py-10">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal-700">
                <ShieldCheck className="size-4" />
                내부 관리자
              </div>
              <h1 className="font-serif text-5xl text-ink-950">
                랜딩 경로 관리
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-600">
                공개 홈에 노출하지 않는 글로벌 피부 패키지 랜딩 경로를 언어권과
                시장별로 관리합니다. 승인된 기본 경로는 코드에서 렌더링하고,
                신규 초안은 Supabase 운영 테이블에 저장해 배포 전 검수 대상으로
                분리합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-ink-300 text-ink-800"
                onClick={() => void refreshRoutes()}
                disabled={apiStatus === "loading"}
              >
                <RefreshCw
                  className={cn(
                    "size-4",
                    apiStatus === "loading" && "animate-spin"
                  )}
                />
                새로고침
              </Button>
              <Link href="/admin/beta">
                <Button
                  variant="outline"
                  className="border-ink-300 text-ink-800"
                >
                  베타 운영
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/admin/cases">
                <Button className="bg-teal-700 text-white hover:bg-teal-800">
                  케이스 보드
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div
            className={cn(
              "mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm",
              apiStatus === "live" &&
                "border-teal-200 bg-teal-50 text-teal-900",
              apiStatus === "saving" &&
                "border-amber-200 bg-amber-50 text-amber-900",
              apiStatus === "static" && "border-ink-200 bg-white text-ink-700",
              apiStatus === "loading" && "border-ink-200 bg-white text-ink-700",
              apiStatus === "error" &&
                "border-rose-200 bg-rose-50 text-rose-900"
            )}
          >
            <Database className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">
                {apiStatus === "live"
                  ? "DB 저장 연결됨"
                  : apiStatus === "saving"
                    ? "저장 중"
                    : apiStatus === "error"
                      ? "확인 필요"
                      : "운영 저장소 상태"}
              </div>
              <div className="mt-1">{apiMessage}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["전체 경로", routes.length],
              [
                "활성 언어",
                `${localeCount} / ${LANDING_LOCALE_OPTIONS.length}`,
              ],
              [
                "시장 세그먼트",
                `${marketCount} / ${LANDING_MARKET_OPTIONS.length}`,
              ],
              ["패키지 코드", packageCount],
              ["DB 초안", draftCount],
              ["DB 저장", remoteRoutes.length],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-ink-200 bg-white p-4"
              >
                <div className="text-sm font-semibold text-ink-500">
                  {label}
                </div>
                <div className="mt-2 font-serif text-3xl text-ink-950">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-wide grid gap-8">
          <div className="order-3">
            <div className="mb-5 flex items-center gap-2">
              <ListChecks className="size-5 text-teal-700" />
              <h2 className="font-serif text-3xl text-ink-950">경로 목록</h2>
            </div>
            <div className="overflow-x-auto rounded-lg border border-ink-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-4 py-3">경로</th>
                    <th className="px-4 py-3">시장</th>
                    <th className="px-4 py-3">검색 의도</th>
                    <th className="px-4 py-3">패키지</th>
                    <th className="px-4 py-3">출처</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">열기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {routes.map(route => (
                    <tr
                      key={`${route.source ?? "route"}-${route.locale}-${route.slug}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink-950">
                          {languageLabel(route.locale)} /{" "}
                          {route.slug || "초안 경로"}
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-ink-500">
                          {route.title || "제목 없는 경로"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                          {marketLabel(route.market)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {route.intent || "검색 의도 미입력"}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {route.packageIds.join(", ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-ink-500">
                        {route.source === "code" ? "승인 기본값" : "DB/admin"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={route.status} />
                      </td>
                      <td className="px-4 py-3">
                        {route.slug ? (
                          <Link
                            href={`/${route.locale}/${route.slug}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700"
                          >
                            보기
                            <ExternalLink className="size-3.5" />
                          </Link>
                        ) : (
                          <span className="text-ink-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="order-1 rounded-lg border border-ink-200 bg-ink-50 p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <FilePlus2 className="size-5 text-teal-700" />
              <h2 className="font-serif text-3xl text-ink-950">
                경로 초안 추가
              </h2>
            </div>
            <form onSubmit={submitDraft} className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-semibold text-ink-800">
                  언어
                </label>
                <select
                  value={draft.locale}
                  onChange={event =>
                    updateLocale(event.target.value as LandingLocale)
                  }
                  className="h-11 rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  {languageGroups.map(group => (
                    <optgroup
                      key={group.market.code}
                      label={group.market.labelKo}
                    >
                      {group.languages.map(option => (
                        <option key={option.code} value={option.code}>
                          {option.labelKo} / {option.nativeName} ({option.code})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-semibold text-ink-800">
                  시장
                </label>
                <select
                  value={draft.market}
                  onChange={event =>
                    updateDraft("market", event.target.value as WedgeMarket)
                  }
                  className="h-11 rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  {LANDING_MARKET_OPTIONS.map(option => (
                    <option key={option.code} value={option.code}>
                      {option.labelKo} ({option.code})
                    </option>
                  ))}
                </select>
              </div>

              <Field label="슬러그">
                <Input
                  value={draft.slug}
                  onChange={event => updateDraft("slug", event.target.value)}
                  placeholder="korea-skin-package"
                />
              </Field>

              <Field label="Source locale">
                <Input
                  value={draft.translationSourceLocale ?? draft.locale}
                  onChange={event =>
                    updateDraft(
                      "translationSourceLocale",
                      normalizeTranslationLocale(event.target.value)
                    )
                  }
                  placeholder="ko"
                />
              </Field>

              <Field label="Target locales">
                <Input
                  value={(draft.targetLocales ?? []).join(", ")}
                  onChange={event =>
                    updateDraft(
                      "targetLocales",
                      splitLocaleList(event.target.value)
                    )
                  }
                  placeholder="en, ja, zh, ar"
                />
              </Field>

              <label className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 lg:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(draft.autoTranslate)}
                  onChange={event =>
                    updateDraft("autoTranslate", event.target.checked)
                  }
                  className="size-4 rounded border-ink-300 accent-teal-700"
                />
                Auto-translate this landing copy on save
              </label>

              <div className="grid gap-1.5 lg:col-span-2">
                <label className="text-sm font-semibold text-ink-800">
                  Status
                </label>
                <select
                  value={draft.status}
                  onChange={event =>
                    updateDraft(
                      "status",
                      event.target.value as LandingRouteStatus
                    )
                  }
                  className="h-11 rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <Field label="검색 의도">
                <Input
                  value={draft.intent}
                  onChange={event => updateDraft("intent", event.target.value)}
                  placeholder="Korea dermatology package for Arabic patients"
                />
              </Field>
              <Field label="제목" className="lg:col-span-2">
                <Input
                  value={draft.title}
                  onChange={event => updateDraft("title", event.target.value)}
                  placeholder="Landing page title"
                />
              </Field>
              <Field label="부제목" className="lg:col-span-2">
                <textarea
                  value={draft.subtitle}
                  onChange={event =>
                    updateDraft("subtitle", event.target.value)
                  }
                  rows={4}
                  className="w-full resize-none rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  placeholder="환자에게 보여줄 가치 제안"
                />
              </Field>
              <Field label="검색 테마">
                <Input
                  value={draft.searchTheme}
                  onChange={event =>
                    updateDraft("searchTheme", event.target.value)
                  }
                  placeholder="K-beauty clinic package"
                />
              </Field>
              <Field label="주요 버튼 문구">
                <Input
                  value={draft.cta}
                  onChange={event => updateDraft("cta", event.target.value)}
                  placeholder="견적 요청"
                />
              </Field>
              <Field label="보조 버튼 문구">
                <Input
                  value={draft.secondaryCta}
                  onChange={event =>
                    updateDraft("secondaryCta", event.target.value)
                  }
                  placeholder="패키지 보기"
                />
              </Field>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-ink-800">
                  패키지 코드
                </label>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {packageCatalog.map(pkg => (
                    <label
                      key={pkg.id}
                      className="flex gap-2 rounded-md border border-ink-200 bg-white p-3 text-sm text-ink-700"
                    >
                      <input
                        type="checkbox"
                        checked={draft.packageIds.includes(pkg.id)}
                        onChange={() => togglePackage(pkg.id)}
                        className="mt-1 size-4 rounded border-ink-300 accent-teal-700"
                      />
                      <span>
                        <span className="font-semibold text-ink-950">
                          {pkg.id}
                        </span>
                        <span className="block text-xs text-ink-500">
                          {pkg.shortTitle}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 bg-teal-700 text-white hover:bg-teal-800 lg:col-span-2 sm:w-fit"
                disabled={apiStatus === "saving"}
              >
                <Save className="size-4" />
                {apiStatus === "saving" ? "저장 중" : "초안 저장"}
              </Button>
              <p className="rounded-md bg-white p-3 text-xs leading-5 text-ink-500 lg:col-span-2">
                저장된 초안은 공개 홈에 노출되지 않습니다. 실제 게시 전에는
                콘텐츠 심의, 광고 문구 검수, 패키지 가격 범위, 병원 검증 상태를
                확인해야 합니다.
              </p>
            </form>
          </aside>

          <section className="order-2 rounded-lg border border-ink-200 bg-white p-5 md:p-6">
            <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <PackagePlus className="size-5 text-teal-700" />
                <h2 className="font-serif text-3xl text-ink-950">
                  패키지 코드 관리
                </h2>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-ink-300 text-ink-800 md:w-fit"
                onClick={resetPackageDraft}
              >
                신규 코드
              </Button>
            </div>

            <form
              onSubmit={submitPackageDraft}
              className="grid gap-4 lg:grid-cols-4"
            >
              <Field label="코드">
                <Input
                  value={packageDraft.id}
                  onChange={event =>
                    updatePackageDraft("id", event.target.value.toLowerCase())
                  }
                  placeholder="global-skin-01"
                />
              </Field>
              <Field label="짧은 제목">
                <Input
                  value={packageDraft.shortTitle}
                  onChange={event =>
                    updatePackageDraft("shortTitle", event.target.value)
                  }
                  placeholder="Laser starter"
                />
              </Field>
              <div className="grid gap-1.5">
                <label className="text-sm font-semibold text-ink-800">
                  시장
                </label>
                <select
                  value={packageDraft.market}
                  onChange={event =>
                    updatePackageDraft(
                      "market",
                      event.target.value as ManagedPackageSku["market"]
                    )
                  }
                  className="h-11 rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="both">공통 (both)</option>
                  {LANDING_MARKET_OPTIONS.map(option => (
                    <option key={option.code} value={option.code}>
                      {option.labelKo} ({option.code})
                    </option>
                  ))}
                </select>
              </div>
              <Field label="카테고리">
                <Input
                  value={packageDraft.category}
                  onChange={event =>
                    updatePackageDraft("category", event.target.value)
                  }
                  placeholder="skin"
                />
              </Field>
              <Field label="최소 금액 USD">
                <Input
                  type="number"
                  min={0}
                  value={packageDraft.priceMinUsd}
                  onChange={event =>
                    updatePackageDraft(
                      "priceMinUsd",
                      Number(event.target.value)
                    )
                  }
                />
              </Field>
              <Field label="최대 금액 USD">
                <Input
                  type="number"
                  min={0}
                  value={packageDraft.priceMaxUsd}
                  onChange={event =>
                    updatePackageDraft(
                      "priceMaxUsd",
                      Number(event.target.value)
                    )
                  }
                />
              </Field>
              <Field label="소요 일수">
                <Input
                  type="number"
                  min={1}
                  value={packageDraft.durationDays}
                  onChange={event =>
                    updatePackageDraft(
                      "durationDays",
                      Number(event.target.value)
                    )
                  }
                />
              </Field>
              <Field label="회복 기간">
                <Input
                  value={packageDraft.recoveryWindow}
                  onChange={event =>
                    updatePackageDraft("recoveryWindow", event.target.value)
                  }
                  placeholder="0-2 days"
                />
              </Field>
              <Field label="지원 언어" className="lg:col-span-2">
                <Input
                  value={packageDraft.coordinatorLanguages.join(", ")}
                  onChange={event =>
                    updatePackageDraft(
                      "coordinatorLanguages",
                      splitCommaList(event.target.value)
                    )
                  }
                  placeholder="en, ko, ar"
                />
              </Field>

              <Field label="Source locale" className="lg:col-span-2">
                <Input
                  value={packageDraft.translationSourceLocale ?? "ko"}
                  onChange={event =>
                    updatePackageDraft(
                      "translationSourceLocale",
                      normalizeTranslationLocale(event.target.value)
                    )
                  }
                  placeholder="ko"
                />
              </Field>

              <Field label="Target locales" className="lg:col-span-2">
                <Input
                  value={(packageDraft.targetLocales ?? []).join(", ")}
                  onChange={event =>
                    updatePackageDraft(
                      "targetLocales",
                      splitLocaleList(event.target.value)
                    )
                  }
                  placeholder="en, ja, zh, ar"
                />
              </Field>

              <label className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 lg:col-span-4">
                <input
                  type="checkbox"
                  checked={Boolean(packageDraft.autoTranslate)}
                  onChange={event =>
                    updatePackageDraft("autoTranslate", event.target.checked)
                  }
                  className="size-4 rounded border-ink-300 accent-teal-700"
                />
                Auto-translate this package copy on save
              </label>
              <Field label="추천 대상" className="lg:col-span-2">
                <Input
                  value={packageDraft.bestFor}
                  onChange={event =>
                    updatePackageDraft("bestFor", event.target.value)
                  }
                  placeholder="Short Seoul dermatology trips"
                />
              </Field>
              <Field label="포함 항목" className="lg:col-span-2">
                <textarea
                  value={packageDraft.includes.join("\n")}
                  onChange={event =>
                    updatePackageDraft(
                      "includes",
                      splitLineList(event.target.value)
                    )
                  }
                  rows={4}
                  className="w-full resize-none rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  placeholder={
                    "Skin analysis\nProvider quote\nAftercare checklist"
                  }
                />
              </Field>
              <Field label="컴플라이언스 메모" className="lg:col-span-2">
                <textarea
                  value={packageDraft.complianceNote}
                  onChange={event =>
                    updatePackageDraft("complianceNote", event.target.value)
                  }
                  rows={4}
                  className="w-full resize-none rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  placeholder="Final treatment plan and price require provider confirmation."
                />
              </Field>
              <div className="flex flex-wrap gap-3 lg:col-span-4">
                <Button
                  type="submit"
                  className="h-11 bg-teal-700 text-white hover:bg-teal-800"
                  disabled={apiStatus === "saving"}
                >
                  <Save className="size-4" />
                  {editingPackageId ? "코드 수정 저장" : "코드 추가"}
                </Button>
                {editingPackageId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 border-ink-300 text-ink-800"
                    onClick={resetPackageDraft}
                  >
                    취소
                  </Button>
                ) : null}
              </div>
            </form>

            <div className="mt-6 overflow-x-auto rounded-lg border border-ink-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-4 py-3">코드</th>
                    <th className="px-4 py-3">시장</th>
                    <th className="px-4 py-3">가격</th>
                    <th className="px-4 py-3">기간</th>
                    <th className="px-4 py-3">포함 항목</th>
                    <th className="px-4 py-3">출처</th>
                    <th className="px-4 py-3">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 bg-white">
                  {packageCatalog.map(pkg => (
                    <tr key={pkg.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink-950">
                          {pkg.id}
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-ink-500">
                          {pkg.shortTitle}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                          {pkg.market === "both"
                            ? "공통"
                            : marketLabel(pkg.market)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        ${pkg.priceMinUsd.toLocaleString()} - $
                        {pkg.priceMaxUsd.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {pkg.durationDays}일 / {pkg.recoveryWindow || "-"}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {pkg.includes.slice(0, 2).join(", ") || "-"}
                      </td>
                      <td className="px-4 py-3 text-ink-500">
                        {pkg.source === "code" ? "승인 기본값" : "DB/admin"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 border-ink-300 text-ink-800"
                            onClick={() => editPackage(pkg)}
                          >
                            <Pencil className="size-4" />
                            수정
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() => void deletePackage(pkg)}
                          >
                            <Trash2 className="size-4" />
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </Layout>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-sm font-semibold text-ink-800">{label}</span>
      {children}
    </label>
  );
}
