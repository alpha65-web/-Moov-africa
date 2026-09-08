/**
 * Photo du compte, ou ses initiales quand il n'en a pas.
 *
 * La barre laterale, la barre superieure et la page Profil affichaient toujours
 * les initiales : une photo posee par l'administrateur a la creation du compte
 * n'apparaissait nulle part pour son titulaire. Un seul composant pour les
 * trois emplacements, afin qu'ils ne divergent plus.
 */
export default function Avatar({
  firstName, lastName, avatarUrl, className = "size-9", textClass = "text-xs",
}: {
  firstName?: string | null; lastName?: string | null; avatarUrl?: string | null;
  className?: string; textClass?: string;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- data URI stockee en base, hors du pipeline d'optimisation
    return <img src={avatarUrl} alt="" className={`${className} rounded-full object-cover shrink-0`} />;
  }
  return (
    <span className={`${className} rounded-full bg-primary text-white font-bold shrink-0 flex items-center justify-center ${textClass}`}>
      {firstName?.[0]}{lastName?.[0]}
    </span>
  );
}
