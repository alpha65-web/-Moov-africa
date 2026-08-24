package com.moov.pim.permissions.domain;

public enum RoleName {
    SUPER_ADMIN, ADMIN_SYSTEME, CHEF_PRODUIT, ANALYSTE_MARKETING,
    CHEF_SERVICE, CHEF_DEPARTEMENT, COMMUNITY_MANAGER;

    /**
     * Le role voit-il les fiches de tous les acteurs, ou seulement les siennes ?
     *
     * Seul le chef de produit est cloisonne a ses propres fiches, conformement aux
     * regles de visibilite du cahier des charges : « un chef de produit ne voit que
     * les offres qu'il a lui-meme creees, jamais celles des autres chefs de produit ».
     *
     * Tous les autres roles interviennent sur le travail d'autrui : le chef de service
     * valide, le chef de departement publie, l'analyste marketing enrichit, le
     * community manager diffuse, l'administrateur supervise. Les leur cloisonner
     * rendrait leurs permissions inutilisables.
     */
    public boolean hasTransversalScope() {
        return this != CHEF_PRODUIT;
    }
}
