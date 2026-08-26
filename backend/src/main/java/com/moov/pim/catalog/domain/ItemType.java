package com.moov.pim.catalog.domain;

/**
 * Premier niveau de classification commerciale : TYPE.
 *
 * La classification de la plateforme se lit
 * TYPE -> CATEGORIE -> SOUS-CATEGORIE -> ELEMENT. Le type ne se choisit pas
 * librement : il est porte par l'entite elle-meme — un produit est un
 * {@link Product}, un pack un {@link Pack}, une offre commerciale une
 * {@code lifecycle.domain.Offer} — et il conditionne les categories
 * selectionnables. Une categorie appartient a un et un seul type, ce qui rend
 * impossible de ranger un routeur sous « Forfaits Data ».
 *
 * Les valeurs correspondent au discriminant {@code item_type} de la table
 * {@code catalog_items} pour les trois briques du catalogue, et {@link #OFFER}
 * s'applique aux offres du module cycle de vie, qui portent desormais elles
 * aussi une categorie.
 *
 * L'enumeration est volontairement figee. Le type determine quelle entite est
 * creee, quel formulaire est presente et quel circuit de validation s'applique :
 * un type ajoute depuis l'ecran d'administration n'aurait aucune implementation
 * derriere lui et ne produirait qu'un onglet decoratif.
 */
public enum ItemType {

    PRODUCT("Produit"),
    OFFER("Offre"),
    SERVICE("Service"),
    PACK("Pack");

    private final String label;

    ItemType(String label) {
        this.label = label;
    }

    /** Libelle affichable, en francais. */
    public String getLabel() {
        return label;
    }

    /**
     * Convertit une valeur recue de l'exterieur, en refusant l'inconnu.
     *
     * @throws IllegalArgumentException si la valeur ne designe aucun type
     */
    public static ItemType parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Le type est obligatoire");
        }
        try {
            return ItemType.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Type inconnu : " + value
                    + ". Valeurs attendues : PRODUCT, OFFER, SERVICE, PACK");
        }
    }
}
