import Link from "next/link";
import Image from "next/image";
import { type ReactNode } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full h-dvh overflow-hidden">
      {/* ===== PANNEAU GAUCHE — Image (desktop uniquement) ===== */}
      <div className="items-center hidden w-1/2 overflow-hidden bg-white dark:bg-neutral-950 border-r h-full lg:flex border-r-border dark:border-r-neutral-800">
        {/* Remplacer par le visuel Moov Africa */}
        <Image
          src="/img/img2.png"
          alt="Moov Africa"
          width={960}
          height={1080}
          className="object-cover w-full h-full"
          priority
        />
      </div>

      {/* ===== PANNEAU DROIT — Formulaire ===== */}
      <div className="relative flex flex-col w-full h-full effect bg-neutral-50 dark:bg-neutral-950 lg:w-1/2 overflow-hidden">
        {/* Toggle thème — coin haut droit */}
        <div className="absolute z-50 top-4 right-4">
          <ThemeToggle />
        </div>

        {/* Contenu centré verticalement */}
        <div className="flex flex-col items-center justify-center flex-1 px-4 gap-4">
          {/* Image mobile (visible uniquement en dessous de lg) */}
          <div className="w-full max-w-[350px] h-auto rounded-md overflow-hidden lg:hidden">
            <Image
              src="/img/img2.png"
              alt="Moov Africa"
              width={400}
              height={200}
              className="object-cover object-top w-full h-auto max-h-[25vh]"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 50%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 50%, transparent 100%)",
              }}
            />
          </div>

          {/* Logo — swap automatique selon le thème système */}
          <Link href="/" className="flex items-center">
            <Image
              src="/img/logo-light.jpeg"
              alt="Moov Africa"
              width={160}
              height={48}
              className="object-contain h-12 w-auto dark:hidden"
            />
            <Image
              src="/img/logo-dark.jpeg"
              alt="Moov Africa"
              width={160}
              height={48}
              className="object-contain h-12 w-auto hidden dark:block"
            />
          </Link>

          {/* Contenu du formulaire (slot) */}
          {children}
        </div>
      </div>
    </div>
  );
}
