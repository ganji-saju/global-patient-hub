import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Database,
  Handshake,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  betaCases,
  betaPartners,
  betaProviders,
  formatUsd,
  type BetaCase,
} from "@/lib/betaData";
import {
  fetchPartnerMvpSnapshot,
  readAdminApiToken,
  type PartnerMvpSnapshot,
} from "@/lib/partnerMvpApi";
import { cn } from "@/lib/utils";

type DashboardStatus = "demo" | "loading" | "live" | "error";

function humanStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "good" && "border-teal-200 bg-teal-50",
        tone === "warn" && "border-coral-200 bg-coral-50",
        tone === "neutral" && "border-ink-200 bg-white"
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <Icon
          className={cn(
            "size-5",
            tone === "good"
              ? "text-teal-700"
              : tone === "warn"
                ? "text-coral-700"
                : "text-ink-500"
          )}
        />
      </div>
      <div className="font-serif text-3xl text-ink-950">{value}</div>
      <div className="mt-1 text-sm font-semibold text-ink-800">{label}</div>
      <p className="mt-2 text-xs leading-5 text-ink-500">{detail}</p>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  detail,
  href,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  href: string;
  tone?: "neutral" | "warn" | "good";
}) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "grid gap-3 rounded-lg border p-4 transition-colors md:grid-cols-[44px_1fr_24px]",
          tone === "warn" &&
            "border-coral-200 bg-coral-50 hover:bg-coral-100/60",
          tone === "good" && "border-teal-200 bg-teal-50 hover:bg-teal-100/60",
          tone === "neutral" && "border-ink-200 bg-white hover:bg-ink-50"
        )}
      >
        <div className="grid size-11 place-items-center rounded-md bg-white text-teal-700">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="font-semibold text-ink-950">{title}</div>
          <p className="mt-1 text-sm leading-6 text-ink-600">{detail}</p>
        </div>
        <ArrowRight className="mt-1 size-5 text-ink-400" />
      </div>
    </Link>
  );
}

function CaseMiniRow({ row }: { row: BetaCase }) {
  const needsAttention =
    row.status === "quote_requested" ||
    row.status === "deposit_pending" ||
    row.priority === "urgent" ||
    row.riskFlags.length > 0;

  return (
    <div className="grid gap-3 border-b border-ink-100 py-3 last:border-b-0 md:grid-cols-[1fr_0.8fr_0.8fr_0.8fr]">
      <div>
        <div className="font-semibold text-ink-950">{row.patientAlias}</div>
        <div className="text-xs text-ink-500">
          {row.id} / {row.packageId}
        </div>
      </div>
      <div className="text-sm text-ink-700">{row.procedure}</div>
      <div className="text-sm text-ink-700">
        {formatUsd(row.budgetMinUsd)} - {formatUsd(row.budgetMaxUsd)}
      </div>
      <div
        className={cn(
          "text-sm font-semibold",
          needsAttention ? "text-coral-700" : "text-teal-700"
        )}
      >
        {humanStatus(row.status)}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [snapshot, setSnapshot] = useState<PartnerMvpSnapshot | null>(null);
  const [status, setStatus] = useState<DashboardStatus>("demo");
  const [message, setMessage] = useState(
    "Demo data is shown until email auth is connected."
  );
  const [token] = useState(() => readAdminApiToken());

  async function refresh() {
    if (!token) {
      setStatus("demo");
      setMessage(
        "Email-authenticated admin session is not available. Showing demo data."
      );
      return;
    }

    setStatus("loading");
    setMessage("Loading live operations snapshot...");
    try {
      const nextSnapshot = await fetchPartnerMvpSnapshot(token);
      setSnapshot(nextSnapshot);
      setStatus("live");
      setMessage("Live Supabase operations snapshot loaded.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load operations snapshot."
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const cases = snapshot?.cases.length ? snapshot.cases : betaCases;
  const partners = snapshot?.partners.length ? snapshot.partners : betaPartners;
  const providers = snapshot?.providers.length
    ? snapshot.providers
    : betaProviders;
  const quoteRequests = snapshot?.providerQuoteRequests ?? [];
  const quotes = snapshot?.quotes ?? [];
  const slots = snapshot?.availabilitySlots ?? [];
  const bookings = snapshot?.bookings ?? [];
  const meta = snapshot?.meta;
  const persistence = meta?.adminPersistenceHealth;

  const attentionCases = cases.filter(row =>
    [
      "new",
      "qualified",
      "matching_ready",
      "quote_requested",
      "deposit_pending",
    ].includes(row.status)
  );
  const partnerRequests = cases.filter(
    row =>
      row.partnerAssistanceMode &&
      row.partnerAssistanceMode !== "platform_direct"
  );
  const quoteRequestedCases = cases.filter(
    row => row.status === "quote_requested"
  );
  const depositPendingCases = cases.filter(
    row => row.status === "deposit_pending"
  );
  const heldSlots = slots.filter(row => row.status === "held");
  const readyProviders = providers.filter(
    provider =>
      provider.active &&
      provider.registrationVerified &&
      provider.quoteTemplateReady
  );
  const activePartners = partners.filter(partner => partner.active);
  const responseQuotes =
    quotes.length || quoteRequests.filter(row => row.quote).length;

  const upcomingCases = useMemo(
    () =>
      [...attentionCases]
        .sort((a, b) => a.nextActionAt.localeCompare(b.nextActionAt))
        .slice(0, 6),
    [attentionCases]
  );

  const statusTone =
    status === "live" ? "good" : status === "error" ? "warn" : "neutral";

  return (
    <Layout>
      <section className="border-b border-ink-200 bg-white">
        <div className="container-wide py-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700">
                <Activity className="size-4" />
                GCL operations
              </div>
              <h1 className="font-serif text-5xl text-ink-950">
                운영 대시보드
              </h1>
              <p className="mt-3 max-w-3xl text-ink-600">
                환자 상담, 파트너 지원 요청, 병원 견적, 임시 홀드, 예약금 결제,
                운영 체크리스트를 한 화면에서 확인합니다.
              </p>
            </div>
            <Button
              type="button"
              onClick={refresh}
              disabled={status === "loading"}
              className="bg-teal-700 text-white hover:bg-teal-800 disabled:bg-ink-300"
            >
              <RefreshCw
                className={cn("size-4", status === "loading" && "animate-spin")}
              />
              새로고침
            </Button>
          </div>

          <div
            className={cn(
              "mt-6 rounded-lg border p-4",
              statusTone === "good" && "border-teal-200 bg-teal-50",
              statusTone === "warn" && "border-coral-200 bg-coral-50",
              statusTone === "neutral" && "border-ink-200 bg-ink-50"
            )}
          >
            <div className="flex items-center gap-2 font-semibold text-ink-950">
              {status === "error" ? (
                <TriangleAlert className="size-5 text-coral-700" />
              ) : (
                <ShieldCheck className="size-5 text-teal-700" />
              )}
              {message}
            </div>
            <p className="mt-2 text-sm text-ink-600">
              Snapshot: {formatDateTime(meta?.generatedAt)} / Mode:{" "}
              {meta?.paymentMode ?? "demo"}
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-ink-50">
        <div className="container-wide grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={ClipboardList}
              label="처리 필요 케이스"
              value={attentionCases.length}
              detail="신규, 매칭 준비, 견적 요청, 예약금 대기 상태입니다."
              tone={attentionCases.length ? "warn" : "good"}
            />
            <MetricCard
              icon={Handshake}
              label="파트너 지원 요청"
              value={meta?.partnerRequestCount ?? partnerRequests.length}
              detail="상담 신청에서 비의료 지원이 필요한 건입니다."
              tone={partnerRequests.length ? "warn" : "neutral"}
            />
            <MetricCard
              icon={WalletCards}
              label="견적 요청/응답"
              value={`${meta?.quoteRequestCount ?? quoteRequests.length}/${meta?.quoteResponseCount ?? responseQuotes}`}
              detail="병원 후보에 견적 요청 후 응답까지 추적합니다."
              tone={quoteRequestedCases.length ? "warn" : "neutral"}
            />
            <MetricCard
              icon={CalendarClock}
              label="임시 홀드/예약"
              value={`${heldSlots.length}/${bookings.length}`}
              detail="예약 캘린더의 held 슬롯과 확정 예약입니다."
              tone={heldSlots.length ? "warn" : "neutral"}
            />
            <MetricCard
              icon={CreditCard}
              label="Stripe"
              value={meta?.paymentMode ?? "demo"}
              detail="예약금 Checkout 세션 생성 가능 여부입니다."
              tone={meta?.stripeConfigured ? "good" : "warn"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <div className="grid gap-6">
              <div className="rounded-lg border border-ink-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-3xl text-ink-950">
                      오늘 먼저 볼 작업
                    </h2>
                    <p className="mt-1 text-sm text-ink-500">
                      숫자가 올라간 항목은 바로 해당 업무 화면으로 이동합니다.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <ActionRow
                    icon={ClipboardList}
                    title="케이스 매칭 및 파트너 배정"
                    detail={`${attentionCases.length}건의 케이스가 다음 운영 액션을 기다립니다.`}
                    href="/admin/cases"
                    tone={attentionCases.length ? "warn" : "good"}
                  />
                  <ActionRow
                    icon={WalletCards}
                    title="병원 견적 요청과 예약금 흐름"
                    detail={`${quoteRequestedCases.length}건 견적 요청, ${depositPendingCases.length}건 예약금 대기 상태입니다.`}
                    href="/admin/quote-booking"
                    tone={
                      quoteRequestedCases.length || depositPendingCases.length
                        ? "warn"
                        : "neutral"
                    }
                  />
                  <ActionRow
                    icon={CalendarClock}
                    title="예약 캘린더와 임시 홀드"
                    detail={`${heldSlots.length}개 슬롯이 held 상태입니다. 만료 전 확인이 필요합니다.`}
                    href="/admin/reservation-calendar"
                    tone={heldSlots.length ? "warn" : "neutral"}
                  />
                  <ActionRow
                    icon={Database}
                    title="운영 체크리스트"
                    detail={`Admin persistence: ${persistence?.ready ? "정상" : "확인 필요"} / notifications: ${
                      meta?.notificationOutboxConfigured ||
                      meta?.notificationDispatchConfigured
                        ? "준비"
                        : "확인 필요"
                    }`}
                    href="/admin/ops-health"
                    tone={persistence?.ready ? "good" : "warn"}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-ink-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-3xl text-ink-950">
                      우선 확인 케이스
                    </h2>
                    <p className="mt-1 text-sm text-ink-500">
                      다음 액션 시간이 빠른 순서입니다.
                    </p>
                  </div>
                  <Link href="/admin/cases">
                    <Button
                      variant="outline"
                      className="border-ink-300 text-ink-800"
                    >
                      전체 보기
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <div className="min-w-[760px]">
                    {upcomingCases.length ? (
                      upcomingCases.map(row => (
                        <CaseMiniRow key={row.id} row={row} />
                      ))
                    ) : (
                      <div className="rounded-md border border-ink-200 bg-ink-50 p-4 text-sm text-ink-500">
                        지금 바로 처리할 케이스가 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <aside className="grid content-start gap-4">
              <div className="rounded-lg border border-ink-200 bg-white p-5">
                <h2 className="font-serif text-2xl text-ink-950">
                  네트워크 준비도
                </h2>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-md bg-ink-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                      <Building2 className="size-4 text-teal-700" />
                      병원
                    </div>
                    <div className="mt-2 text-2xl font-serif text-ink-950">
                      {readyProviders.length}/{providers.length}
                    </div>
                    <p className="text-xs text-ink-500">
                      활성 + 검증 + 견적 템플릿 준비
                    </p>
                  </div>
                  <div className="rounded-md bg-ink-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                      <Handshake className="size-4 text-teal-700" />
                      에이전트
                    </div>
                    <div className="mt-2 text-2xl font-serif text-ink-950">
                      {activePartners.length}/{partners.length}
                    </div>
                    <p className="text-xs text-ink-500">활성 파트너 계정</p>
                  </div>
                  <div className="rounded-md bg-ink-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                      <BellRing className="size-4 text-teal-700" />
                      알림
                    </div>
                    <div className="mt-2 text-sm font-semibold text-ink-950">
                      {meta?.notificationOutboxConfigured ||
                      meta?.notificationDispatchConfigured
                        ? "Outbox ready"
                        : "확인 필요"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-ink-200 bg-white p-5">
                <h2 className="font-serif text-2xl text-ink-950">빠른 이동</h2>
                <div className="mt-4 grid gap-2">
                  {[
                    ["/admin/providers", "병원등록"],
                    ["/admin/partners", "에이전트등록"],
                    ["/admin/landing-routes", "랜딩 경로"],
                    ["/provider/quotes", "병원 견적"],
                    ["/partner/cases", "파트너 케이스"],
                  ].map(([href, label]) => (
                    <Link key={href} href={href}>
                      <Button
                        variant="outline"
                        className="w-full justify-between border-ink-300 text-ink-800"
                      >
                        {label}
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
}
