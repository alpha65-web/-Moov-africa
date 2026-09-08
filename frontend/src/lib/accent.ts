/**
 * Couleur de la barre qui borde une carte de chiffres, deduite de la couleur de
 * son icone.
 *
 * Les cartes portent deja une teinte par indicateur (icone et fond). La barre
 * reprend cette teinte sur le bord gauche : l'oeil repere la famille de
 * l'indicateur avant de lire son libelle. Les classes sont ecrites en clair
 * pour que la generation des styles les trouve ; une couleur inconnue retombe
 * sur le bleu de la marque.
 */
const BAR_BY_TEXT_COLOR: Record<string, string> = {
  "text-blue-600": "bg-blue-600",
  "text-emerald-600": "bg-emerald-600",
  "text-green-600": "bg-green-600",
  "text-purple-600": "bg-purple-600",
  "text-amber-600": "bg-amber-600",
  "text-orange-600": "bg-orange-600",
  "text-red-600": "bg-red-600",
  "text-sky-600": "bg-sky-600",
  "text-teal-600": "bg-teal-600",
  "text-neutral-600": "bg-neutral-400",
  "text-primary": "bg-primary",
  "text-brand": "bg-brand",
};

export function accentBar(colorClasses: string): string {
  const key = colorClasses.split(/\s+/).find((c) => c.startsWith("text-"));
  return (key && BAR_BY_TEXT_COLOR[key]) || "bg-brand";
}
