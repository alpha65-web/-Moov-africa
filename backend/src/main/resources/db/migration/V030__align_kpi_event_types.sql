-- KpiEventListener n'emet que OFFER_CREATED et STATUS_<statut>. Le jeu de demonstration
-- V024 utilisait un vocabulaire different (OFFER_ENRICHED, OFFER_VALIDATED, OFFER_PUBLISHED),
-- si bien que l'historique seede et les evenements produits en direct pendant une
-- demonstration n'apparaissaient pas sous le meme libelle dans l'ecran Analyses.
--
-- TIME_TO_MARKET et CAMPAIGN_SENT sont conserves : ce sont des mesures metier
-- referencees par kpi_configs, et non des transitions de statut.
UPDATE kpi_events SET event_type = 'STATUS_IN_ENRICHMENT' WHERE event_type = 'OFFER_ENRICHED';
UPDATE kpi_events SET event_type = 'STATUS_VALIDATED'     WHERE event_type = 'OFFER_VALIDATED';
UPDATE kpi_events SET event_type = 'STATUS_PUBLISHED'     WHERE event_type = 'OFFER_PUBLISHED';
