import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";

/* Icône custom badge — signal réseau stylisé (branding télécom) */
function SignalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="11" width="2.5" height="4" rx="0.75" fill="currentColor" />
      <rect x="5" y="8" width="2.5" height="7" rx="0.75" fill="currentColor" />
      <rect x="9" y="4.5" width="2.5" height="10.5" rx="0.75" fill="currentColor" />
      <rect x="13" y="1" width="2.5" height="14" rx="0.75" fill="currentColor" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="effect w-full h-dvh flex flex-col overflow-hidden">
      {/* ===== NAVBAR ===== */}
      <nav className="flex items-center justify-center w-full px-4 bg-white dark:bg-neutral-900 shadow-sm sm:px-6 shrink-0">
        <div className="flex items-center justify-between w-full py-2 max-w-7xl">
          {/* Logo — swap automatique selon le thème système */}
          <Link href="/">
            <Image
              src="/img/logo-light.jpeg"
              alt="Moov Africa"
              width={160}
              height={40}
              className="h-10 w-auto dark:hidden"
            />
            <Image
              src="/img/logo-dark.jpeg"
              alt="Moov Africa"
              width={160}
              height={40}
              className="h-10 w-auto hidden dark:block"
            />
          </Link>
          {/* Actions navbar — toggle thème + connexion */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="primary-icon px-3 py-1.5 active-scale">
              <span className="flex items-center">
                <p className="whitespace-nowrap text-sm">Se connecter</p>
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== SECTION HERO — prend tout l'espace restant ===== */}
      <div className="flex items-center flex-col relative w-full flex-1 p-4 overflow-hidden">
        <div className="flex flex-col gap-4 md:gap-6 items-center mt-8 md:mt-16 w-full py-2 max-w-3xl z-10">
          <div className="flex flex-col gap-2 items-center w-full">
            {/* Badge — icône signal custom */}
            <span className="text-sm py-1 px-3 rounded-lg font-semibold bg-neutral-100 dark:bg-neutral-800 flex items-center gap-1.5 border border-orange-900/20 text-orange-900 dark:text-orange-400">
              <SignalIcon className="w-3.5 h-3.5" />
              Plateforme PIM Moov Africa
            </span>
            {/* Titre principal */}
            <h1 className="text-secondary dark:text-white tracking-tight leading-tight text-center font-bold text-balance text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
              L&apos;information produit, maîtrisée de bout en bout.
            </h1>
            {/* Sous-titre / description */}
            <p className="text-neutral-500 dark:text-neutral-400 font-semibold text-sm md:text-base text-pretty tracking-tight w-full max-w-lg text-center leading-relaxed">
              Centralisez, enrichissez et publiez vos offres sur tous vos canaux
              depuis une interface unique, conçue pour les équipes de Moov
              Africa Burkina Faso.
            </p>
          </div>

          {/* Bouton CTA principal */}
          <div className="relative p-3 border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <Link
              href="/login"
              className="primary-icon px-5 py-2.5 !rounded-lg active-scale"
            >
              <span className="flex items-center">
                <p className="whitespace-nowrap text-sm font-semibold">
                  Accéder à la plateforme
                </p>
              </span>
            </Link>
            {/* Points décoratifs aux 4 coins */}
            <div className="absolute top-1 left-1 size-1 rounded-full bg-secondary/20 dark:bg-white/20" />
            <div className="absolute top-1 right-1 size-1 rounded-full bg-secondary/20 dark:bg-white/20" />
            <div className="absolute bottom-1 left-1 size-1 rounded-full bg-secondary/20 dark:bg-white/20" />
            <div className="absolute bottom-1 right-1 size-1 rounded-full bg-secondary/20 dark:bg-white/20" />
          </div>
        </div>

        {/* ===== IMAGE HERO — positionnée en bas, responsive ===== */}
        <div className="absolute bottom-0 left-0 w-full">
          <Image
            src="/img/bureau_des_etudiants.png"
            alt="Moov Africa Plateforme"
            width={1024}
            height={600}
            className="object-cover object-bottom w-full max-w-5xl drop-shadow-2xl h-auto mx-auto"
          />
        </div>
      </div>
    </div>
  );
}
