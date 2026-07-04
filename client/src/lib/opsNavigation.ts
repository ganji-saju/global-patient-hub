import type { OpsRole } from "@/lib/partnerMvpApi";

export type OpsNavigationItem = {
  href: string;
  label: string;
  roles: readonly OpsRole[];
};

export const OPS_ADMIN_ONLY_ROLES = [
  "admin",
] as const satisfies readonly OpsRole[];
export const OPS_ALL_ROLES = [
  "admin",
  "partner",
  "provider",
] as const satisfies readonly OpsRole[];
export const OPS_PARTNER_ROLES = [
  "admin",
  "partner",
] as const satisfies readonly OpsRole[];
export const OPS_PROVIDER_ROLES = [
  "admin",
  "provider",
] as const satisfies readonly OpsRole[];
export const OPS_SHARED_WORKFLOW_ROLES = OPS_ALL_ROLES;

export const OPS_ROLE_HOME: Record<OpsRole, string> = {
  admin: "/admin/dashboard",
  partner: "/partner/cases",
  provider: "/provider/quotes",
};

export const OPS_NAVIGATION_ITEMS: readonly OpsNavigationItem[] = [
  {
    href: "/admin/dashboard",
    label: "운영 대시보드",
    roles: OPS_ADMIN_ONLY_ROLES,
  },
  {
    href: "/admin/ops-health",
    label: "운영 점검",
    roles: OPS_ADMIN_ONLY_ROLES,
  },
  { href: "/admin/cases", label: "케이스", roles: OPS_ADMIN_ONLY_ROLES },
  { href: "/partner/cases", label: "파트너 케이스", roles: OPS_PARTNER_ROLES },
  { href: "/provider/quotes", label: "병원 견적", roles: OPS_PROVIDER_ROLES },
  {
    href: "/admin/quote-booking",
    label: "견적/예약",
    roles: OPS_SHARED_WORKFLOW_ROLES,
  },
  {
    href: "/admin/reservation-calendar",
    label: "예약 캘린더",
    roles: OPS_SHARED_WORKFLOW_ROLES,
  },
  { href: "/admin/providers", label: "병원등록", roles: OPS_ADMIN_ONLY_ROLES },
  {
    href: "/admin/partners",
    label: "에이전트등록",
    roles: OPS_ADMIN_ONLY_ROLES,
  },
  { href: "/admin/beta", label: "베타 운영", roles: OPS_ADMIN_ONLY_ROLES },
  {
    href: "/admin/landing-routes",
    label: "랜딩 경로",
    roles: OPS_ADMIN_ONLY_ROLES,
  },
];

export function roleCanUseOpsItem(role: OpsRole, item: OpsNavigationItem) {
  return role === "admin" || item.roles.includes(role);
}

export function getOpsNavigationItems(role: OpsRole, authenticated: boolean) {
  if (!authenticated) return [];
  return OPS_NAVIGATION_ITEMS.filter(item => roleCanUseOpsItem(role, item));
}

export function getHiddenOpsNavigationItems(
  role: OpsRole,
  authenticated: boolean
) {
  if (!authenticated) return OPS_NAVIGATION_ITEMS;
  return OPS_NAVIGATION_ITEMS.filter(item => !roleCanUseOpsItem(role, item));
}

export function getOpsRoleHomePath(role: OpsRole) {
  return OPS_ROLE_HOME[role] ?? OPS_ROLE_HOME.admin;
}
