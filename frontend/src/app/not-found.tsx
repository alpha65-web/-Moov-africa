"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="flex items-center justify-center min-h-dvh bg-bg dark:bg-neutral-950 p-4">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <Image
          src="/img/logo-light.jpeg"
          alt="Moov Africa"
          width={120}
          height={34}
          className="h-8 w-auto dark:hidden"
        />
        <Image
          src="/img/logo-dark.jpeg"
          alt="Moov Africa"
          width={120}
          height={34}
          className="h-8 w-auto hidden dark:block"
        />

        <div className="flex flex-col items-center gap-2">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg className="size-8 text-primary" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-black dark:text-white">{t("title")}</h1>
          <p className="text-sm text-text-secondary dark:text-neutral-500">
            {t("message")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="primary-icon px-5 py-2.5 active-scale"
          >
            <span className="flex items-center gap-2">
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L2 8l6 6M2.5 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-medium">{t("dashboard")}</p>
            </span>
          </Link>
          <Link
            href="/login"
            className="tertiary-icon px-4 py-2.5 active-scale"
          >
            <p className="text-sm font-medium">{t("login")}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
