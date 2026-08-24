import type { KeyboardEvent } from "react";

/**
 * Comportement clavier commun a tous les champs de recherche.
 *
 * Le filtrage s'applique a la frappe, mais aucun champ n'interceptait la touche
 * Entree : elle ne produisait donc aucun effet visible, et lorsque le champ se
 * trouvait dans un formulaire (recherche d'elements d'un pack, ecran Catalogue)
 * elle en declenchait la soumission prematuree.
 *
 * Entree valide la saisie : la soumission du formulaire parent est bloquee et le
 * champ rend la main, ce qui donne un retour immediat a l'utilisateur.
 * Echap vide le champ et retablit la liste complete.
 */
export function searchKeyHandler(setSearch: (value: string) => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSearch("");
    }
  };
}
