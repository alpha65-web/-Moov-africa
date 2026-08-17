"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Slide {
  title: string;
  subtitle: string;
  gradient: string;
  icon: React.ReactNode;
}

function CatalogIcon() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="w-full h-full">
      {/* Carte principale */}
      <rect x="30" y="20" width="140" height="120" rx="12" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      {/* Lignes produit */}
      <rect x="50" y="40" width="60" height="8" rx="4" fill="white" fillOpacity="0.6" />
      <rect x="50" y="56" width="40" height="6" rx="3" fill="white" fillOpacity="0.3" />
      {/* Icône boîte */}
      <rect x="120" y="36" width="32" height="32" rx="8" fill="white" fillOpacity="0.15" />
      <path d="M130 46 l6 3 l6 -3 M136 49 v8" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
      {/* Deuxième ligne */}
      <rect x="50" y="80" width="55" height="8" rx="4" fill="white" fillOpacity="0.5" />
      <rect x="50" y="96" width="35" height="6" rx="3" fill="white" fillOpacity="0.25" />
      <rect x="120" y="76" width="32" height="32" rx="8" fill="white" fillOpacity="0.1" />
      <circle cx="136" cy="92" r="8" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
      {/* Badge + */}
      <circle cx="155" cy="25" r="14" fill="white" fillOpacity="0.2" />
      <path d="M155 19 v12 M149 25 h12" stroke="white" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="w-full h-full">
      {/* Grille de médias */}
      <rect x="20" y="15" width="75" height="60" rx="10" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      <circle cx="42" cy="35" r="8" fill="white" fillOpacity="0.3" />
      <path d="M20 55 l20 -15 l15 10 l10 -5 l30 20" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Image 2 */}
      <rect x="105" y="15" width="75" height="60" rx="10" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M125 50 l12 -18 l12 14 l8 -8 l18 22" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Vidéo en bas */}
      <rect x="20" y="85" width="75" height="60" rx="10" fill="white" fillOpacity="0.08" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      <circle cx="57" cy="115" r="14" fill="white" fillOpacity="0.15" />
      <path d="M52 108 l12 7 l-12 7z" fill="white" fillOpacity="0.5" />
      {/* Document */}
      <rect x="105" y="85" width="75" height="60" rx="10" fill="white" fillOpacity="0.06" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      <rect x="118" y="100" width="48" height="5" rx="2.5" fill="white" fillOpacity="0.3" />
      <rect x="118" y="112" width="36" height="5" rx="2.5" fill="white" fillOpacity="0.2" />
      <rect x="118" y="124" width="42" height="5" rx="2.5" fill="white" fillOpacity="0.15" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="w-full h-full">
      {/* Étape 1 — Brouillon */}
      <rect x="15" y="55" width="40" height="40" rx="10" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
      <rect x="24" y="67" width="22" height="4" rx="2" fill="white" fillOpacity="0.5" />
      <rect x="24" y="77" width="16" height="4" rx="2" fill="white" fillOpacity="0.3" />
      {/* Flèche 1→2 */}
      <path d="M58 75 h18" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M72 71 l4 4 l-4 4" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Étape 2 — Validation */}
      <rect x="80" y="55" width="40" height="40" rx="10" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" />
      <circle cx="100" cy="72" r="10" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <path d="M95 72 l4 4 l7 -7" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Flèche 2→3 */}
      <path d="M123 75 h18" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M137 71 l4 4 l-4 4" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Étape 3 — Publié */}
      <rect x="145" y="55" width="40" height="40" rx="10" fill="white" fillOpacity="0.25" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      <path d="M158 72 l7 -8 l7 8 M165 64 v18" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Labels */}
      <text x="35" y="115" textAnchor="middle" fill="white" fillOpacity="0.4" fontSize="10" fontWeight="500">Brouillon</text>
      <text x="100" y="115" textAnchor="middle" fill="white" fillOpacity="0.5" fontSize="10" fontWeight="500">Validation</text>
      <text x="165" y="115" textAnchor="middle" fill="white" fillOpacity="0.6" fontSize="10" fontWeight="500">Publié</text>
      {/* Ligne de progression */}
      <rect x="15" y="130" width="170" height="4" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="15" y="130" width="120" height="4" rx="2" fill="white" fillOpacity="0.3" />
    </svg>
  );
}

function ChannelsIcon() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="w-full h-full">
      {/* Centre — offre */}
      <circle cx="100" cy="80" r="22" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
      <rect x="88" y="73" width="24" height="5" rx="2.5" fill="white" fillOpacity="0.5" />
      <rect x="92" y="83" width="16" height="4" rx="2" fill="white" fillOpacity="0.3" />
      {/* SMS — haut gauche */}
      <line x1="82" y1="62" x2="55" y2="35" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="30" y="15" width="36" height="28" rx="8" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.25" strokeWidth="1.2" />
      <rect x="38" y="24" width="20" height="3" rx="1.5" fill="white" fillOpacity="0.4" />
      <rect x="38" y="31" width="14" height="3" rx="1.5" fill="white" fillOpacity="0.25" />
      {/* Email — haut droit */}
      <line x1="118" y1="62" x2="148" y2="35" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="134" y="15" width="36" height="28" rx="8" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.25" strokeWidth="1.2" />
      <path d="M140 22 l11 8 l11 -8" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
      {/* Push — droite */}
      <line x1="122" y1="80" x2="152" y2="80" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="155" y="65" width="30" height="30" rx="8" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.25" strokeWidth="1.2" />
      <path d="M170 72 a5 5 0 00-5 5 v5 h10 v-5 a5 5 0 00-5-5z" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="170" cy="86" r="1.5" fill="white" fillOpacity="0.4" />
      {/* USSD — bas gauche */}
      <line x1="82" y1="98" x2="55" y2="125" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="30" y="112" width="36" height="28" rx="8" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.25" strokeWidth="1.2" />
      <text x="48" y="131" textAnchor="middle" fill="white" fillOpacity="0.4" fontSize="10" fontWeight="600">*#</text>
      {/* Social — bas droit */}
      <line x1="118" y1="98" x2="148" y2="125" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      <rect x="134" y="112" width="36" height="28" rx="8" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.25" strokeWidth="1.2" />
      <circle cx="152" cy="126" r="7" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" />
      <path d="M149 126 h6 M152 123 v6" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="w-full h-full">
      {/* Axes */}
      <path d="M30 130 h150" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M30 130 v-100" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      {/* Barres */}
      <rect x="50" y="85" width="18" height="45" rx="4" fill="white" fillOpacity="0.15" />
      <rect x="78" y="60" width="18" height="70" rx="4" fill="white" fillOpacity="0.2" />
      <rect x="106" y="45" width="18" height="85" rx="4" fill="white" fillOpacity="0.25" />
      <rect x="134" y="30" width="18" height="100" rx="4" fill="white" fillOpacity="0.35" />
      {/* Courbe tendance */}
      <path d="M59 82 Q89 55 115 42 T153 28" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="59" cy="82" r="3" fill="white" fillOpacity="0.6" />
      <circle cx="87" cy="57" r="3" fill="white" fillOpacity="0.6" />
      <circle cx="115" cy="42" r="3" fill="white" fillOpacity="0.6" />
      <circle cx="143" cy="28" r="3" fill="white" fillOpacity="0.6" />
      {/* KPI badge haut droit */}
      <rect x="140" y="10" width="50" height="22" rx="6" fill="white" fillOpacity="0.12" />
      <path d="M150 18 l4 5 l8 -8" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="170" y="24" fill="white" fillOpacity="0.5" fontSize="9" fontWeight="600">+24%</text>
    </svg>
  );
}

const SLIDES: Slide[] = [
  {
    title: "Centralisation des produits",
    subtitle: "Gérez vos produits, services et packs depuis un catalogue unique et structuré",
    gradient: "linear-gradient(135deg, #1e40af, #3b82f6)",
    icon: <CatalogIcon />,
  },
  {
    title: "Contenus multimédias",
    subtitle: "Importez, organisez et validez tous vos assets visuels en un seul endroit",
    gradient: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    icon: <MediaIcon />,
  },
  {
    title: "Workflow de validation",
    subtitle: "Faites passer vos offres du brouillon à la publication avec un circuit de validation maîtrisé",
    gradient: "linear-gradient(135deg, #059669, #34d399)",
    icon: <WorkflowIcon />,
  },
  {
    title: "Diffusion multi-canal",
    subtitle: "Distribuez vos offres sur SMS, Email, Push et USSD depuis une seule interface",
    gradient: "linear-gradient(135deg, #ea580c, #f97316)",
    icon: <ChannelsIcon />,
  },
  {
    title: "Performances & KPIs",
    subtitle: "Suivez vos indicateurs clés et pilotez la performance de vos offres en temps réel",
    gradient: "linear-gradient(135deg, #0f766e, #2dd4bf)",
    icon: <AnalyticsIcon />,
  },
];

const INTERVAL = 4000;

export default function ChannelCarousel() {
  const [active, setActive] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleNext = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, INTERVAL);
  }, [active]);

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [scheduleNext]);

  return (
    <div className="relative w-full h-full">
      {/* Zone principale */}
      <div className="absolute inset-0 overflow-hidden">
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className="absolute inset-0 flex flex-col items-center justify-center p-10 xl:p-14 transition-all duration-700 ease-in-out"
            style={{
              background: slide.gradient,
              opacity: i === active ? 1 : 0,
              transform: i === active
                ? "translateX(0)"
                : i < active
                  ? "translateX(-30px)"
                  : "translateX(30px)",
              pointerEvents: i === active ? "auto" : "none",
            }}
          >
            {/* Illustration SVG */}
            <div className="w-48 h-36 xl:w-56 xl:h-44 mb-8 xl:mb-10 opacity-90">
              {slide.icon}
            </div>

            {/* Texte */}
            <div className="text-center max-w-sm">
              <h2 className="text-2xl xl:text-3xl font-bold text-white tracking-tight mb-3">
                {slide.title}
              </h2>
              <p className="text-white/75 text-sm xl:text-base font-medium leading-relaxed">
                {slide.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Indicateurs */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 px-8 py-5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="relative rounded-full overflow-hidden transition-all duration-500"
            style={{ width: i === active ? 32 : 8, height: 6 }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: i < active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
              }}
            />
            {i === active && (
              <div
                className="absolute inset-0 bg-white rounded-full"
                style={{ animation: `grow ${INTERVAL}ms linear forwards` }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
