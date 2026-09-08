import Image from "next/image";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import ThemeToggle from "@/components/ThemeToggle";
import { CampaignIcon, CatalogIcon, MediaIcon, OffersIcon } from "@/components/NavIcons";

/**
 * Ecran d'entree en deux volets.
 *
 * A gauche, sur le bleu Moov, ce que la plateforme fait — quatre fonctions
 * reellement livrees, pas une promesse. A droite, le formulaire. Le volet gauche
 * disparait sous la largeur d'un ordinateur portable : le formulaire seul suffit
 * sur telephone.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("login.panel");

  const features = [
    { key: "catalog", icon: CatalogIcon },
    { key: "workflow", icon: OffersIcon },
    { key: "media", icon: MediaIcon },
    { key: "diffusion", icon: CampaignIcon },
  ] as const;

  return (
    <div className="flex w-full h-dvh overflow-hidden">
      {/* ===== VOLET GAUCHE : identite et fonctions ===== */}
      <div className="hidden lg:flex w-[46%] h-full flex-col justify-between overflow-hidden rounded-r-3xl shadow-xl shadow-black/10 bg-gradient-to-br from-brand-dark via-brand to-brand-light text-white px-12 py-10 relative">
        {/* Deux cercles en transparence, pour donner du relief sans image de fond. */}
        <div className="absolute -right-32 -bottom-40 size-[520px] rounded-full border-[40px] border-white/5" aria-hidden="true" />
        <div className="absolute -right-10 -bottom-16 size-[320px] rounded-full border-[28px] border-white/5" aria-hidden="true" />

        <div className="relative">
          <Image
            src="/img/logo-dark.jpeg"
            alt="Moov Africa"
            width={220}
            height={124}
            className="h-20 w-auto rounded-xl ring-1 ring-white/20 shadow-lg shadow-black/10"
            priority
          />
          <h1 className="mt-10 text-3xl font-bold leading-tight max-w-md">{t("product")}</h1>
          <p className="mt-3 text-sm text-white/80 leading-relaxed max-w-md">{t("tagline")}</p>

          <ul className="mt-10 flex flex-col gap-4">
            {features.map((f) => (
              <li key={f.key} className="flex items-center gap-3">
                <span className="size-9 rounded-lg bg-primary/90 flex items-center justify-center shrink-0 shadow-md shadow-black/10">
                  <f.icon className="size-[18px] text-white" />
                </span>
                <span className="text-sm text-white/90">{t(`features.${f.key}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">{t("copyright")}</p>
      </div>

      {/* ===== VOLET DROIT : formulaire ===== */}
      <div className="relative flex flex-col w-full h-full effect bg-neutral-50 dark:bg-neutral-950 lg:w-[54%] overflow-hidden">
        <div className="absolute z-50 top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-col items-center flex-1 px-4 overflow-y-auto">
          {children}
        </div>

        <div className="shrink-0 pb-5 pt-2 text-center space-y-1">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{t("restricted")}</p>
          <p className="text-[11px] text-neutral-300 dark:text-neutral-600 lg:hidden">{t("copyright")}</p>
        </div>
      </div>
    </div>
  );
}
