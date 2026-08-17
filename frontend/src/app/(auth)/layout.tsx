import Link from "next/link";
import Image from "next/image";
import { type ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import ChannelCarousel from "@/components/ChannelCarousel";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full h-dvh overflow-hidden">
      {/* ===== PANNEAU GAUCHE — Bannière slides (desktop uniquement) ===== */}
      <div className="hidden w-1/2 overflow-hidden rounded-r-3xl bg-neutral-900 h-full lg:flex">
        <ChannelCarousel />
      </div>

      {/* ===== PANNEAU DROIT — Formulaire ===== */}
      <div className="relative flex flex-col w-full h-full effect bg-neutral-50 dark:bg-neutral-950 lg:w-1/2 overflow-hidden">
        {/* Toggle thème — coin haut droit */}
        <div className="absolute z-50 top-4 right-4">
          <ThemeToggle />
        </div>

        {/* Contenu centré verticalement */}
        <div className="flex flex-col items-center flex-1 px-4 overflow-y-auto">
          {children}
        </div>

        {/* Mentions en bas */}
        <div className="shrink-0 pb-5 pt-2 text-center space-y-1">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Accès réservé aux collaborateurs Moov Africa
          </p>
          <p className="text-[11px] text-neutral-300 dark:text-neutral-600">
            &copy; 2026 Moov Africa Burkina Faso &mdash; Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
