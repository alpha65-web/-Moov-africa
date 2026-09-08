-- Suppression d'un brouillon d'offre.
--
-- Chaque creation d'offre emet un evenement KPI (OFFER_CREATED) qui reference la
-- fiche sans cascade : la suppression d'un brouillon, proposee a l'ecran au chef
-- de produit, repondait donc toujours 409 « encore reference par d'autres
-- donnees ». Un brouillon qui n'a jamais quitte les mains de son auteur n'a pas
-- de Time To Market a mesurer : ses evenements disparaissent avec lui.
--
-- Une notification peut aussi designer un brouillon (affectation a un analyste).
-- Elle garde son sens sans la fiche — elle raconte ce qui s'est passe — et perd
-- seulement son lien.

ALTER TABLE kpi_events
    DROP CONSTRAINT kpi_events_offer_id_fkey,
    ADD CONSTRAINT kpi_events_offer_id_fkey
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;

ALTER TABLE notifications
    DROP CONSTRAINT notifications_related_offer_id_fkey,
    ADD CONSTRAINT notifications_related_offer_id_fkey
        FOREIGN KEY (related_offer_id) REFERENCES offers(id) ON DELETE SET NULL;
