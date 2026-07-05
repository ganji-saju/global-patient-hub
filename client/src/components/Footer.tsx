import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Mail, MapPin, Phone } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { getOpsNavigationItems } from "@/lib/opsNavigation";
import {
  OPS_SESSION_CHANGED_EVENT,
  readAdminApiToken,
  readOpsRole,
} from "@/lib/partnerMvpApi";

export default function Footer() {
  const { t } = useI18n();
  const [location] = useLocation();
  const [opsSession, setOpsSession] = useState(() => ({
    authenticated: Boolean(readAdminApiToken()),
    role: readOpsRole(),
  }));
  const internalMode =
    location.startsWith("/admin") ||
    location.startsWith("/partner") ||
    location.startsWith("/provider");

  const internalLinks = getOpsNavigationItems(
    opsSession.role,
    opsSession.authenticated
  );
  const publicLinks = [
    { href: "/network", label: t("nav.network") },
    { href: "/hospitals", label: t("nav.hospitals") },
    { href: "/treatments", label: t("nav.treatments") },
    { href: "/compare", label: t("nav.compare") },
    { href: "/consultation", label: t("nav.consultation") },
  ];

  useEffect(() => {
    if (!internalMode) return undefined;

    const syncOpsSession = () => {
      setOpsSession({
        authenticated: Boolean(readAdminApiToken()),
        role: readOpsRole(),
      });
    };

    syncOpsSession();
    window.addEventListener("storage", syncOpsSession);
    window.addEventListener(OPS_SESSION_CHANGED_EVENT, syncOpsSession);
    return () => {
      window.removeEventListener("storage", syncOpsSession);
      window.removeEventListener(OPS_SESSION_CHANGED_EVENT, syncOpsSession);
    };
  }, [internalMode, location]);

  return (
    <footer className="border-t border-ink-200 bg-ink-950 text-white">
      <div className="container-wide py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-md bg-white text-xs font-semibold text-ink-950">
                {internalMode ? "OPS" : "GCL"}
              </div>
              <div>
                <div className="font-serif text-xl">
                  {internalMode ? "GCL Ops" : "GCL"}
                </div>
                <div className="text-sm text-teal-200">
                  {internalMode ? "내부 운영 콘솔" : t("footer.tagline")}
                </div>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-ink-300">
              {internalMode
                ? "환자, 파트너, 병원 케이스를 한 곳에서 관리하는 내부 운영 화면입니다."
                : t("footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              {internalMode ? "운영 메뉴" : t("footer.explore")}
            </h4>
            <div className="grid gap-2 text-sm">
              {(internalMode ? internalLinks : publicLinks).map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-ink-300 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">
              {internalMode ? "운영 연락처" : t("footer.contact")}
            </h4>
            <div className="grid gap-3 text-sm text-ink-300">
              <div className="flex gap-2">
                <MapPin className="mt-0.5 size-4 text-teal-300" />
                {internalMode ? "Seoul operations" : t("footer.location")}
              </div>
              <a
                href="tel:+82-2-6200-2026"
                className="flex gap-2 hover:text-white"
              >
                <Phone className="size-4 text-teal-300" />
                +82 2-6200-2026
              </a>
              <a
                href="mailto:care@global-connected-lab.com"
                className="flex gap-2 hover:text-white"
              >
                <Mail className="size-4 text-teal-300" />
                care@global-connected-lab.com
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-wide flex flex-col gap-3 py-5 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {internalMode
              ? `${new Date().getFullYear()} GCL Ops. All rights reserved.`
              : `Copyright ${new Date().getFullYear()} GCL. ${t("footer.rights")}`}
          </p>
          <p>
            {internalMode
              ? "내부 운영 자료는 승인된 역할과 접근 범위 안에서만 사용해야 합니다."
              : t("common.medicalDisclaimer")}
          </p>
        </div>
      </div>
    </footer>
  );
}
