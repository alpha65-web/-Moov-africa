-- Nomenclature de reference : TYPE -> CATEGORIE -> SOUS-CATEGORIE.
--
-- V024 avait seede une arborescence de demonstration sans notion de type
-- (« Data », « Voix », « Mobile Money », « Equipements », « Packs & Bundles »).
-- V044 lui a affecte un type ; cette migration la complete avec la nomenclature
-- attendue, sans rien detruire :
--
--   * les categories existantes sont reutilisees quand le libelle correspond,
--     jamais dupliquees ;
--   * les branches heritees qui font double emploi avec la nouvelle nomenclature
--     ne sont desactivees que si elles ne contiennent aucun element, nulle part
--     dans leur descendance. Une branche qui porte des donnees reste active :
--     desactiver une categorie utilisee rendrait ses elements inclassables.
--
-- Rejouable : chaque insertion est conditionnee a l'absence d'un homonyme dans la
-- meme fratrie, ce qui correspond exactement a l'unicite posee par V044.

-- ============================================================
-- 0. OUTIL DE SEMIS
-- ============================================================
CREATE OR REPLACE FUNCTION pim_seed_category(
    p_id          UUID,
    p_name        TEXT,
    p_description TEXT,
    p_type        TEXT,
    p_parent      UUID
) RETURNS UUID AS $$
DECLARE
    v_id    UUID;
    v_level INT := CASE WHEN p_parent IS NULL THEN 0 ELSE 1 END;
BEGIN
    -- Reutilisation : un homonyme dans la meme fratrie est la meme categorie.
    SELECT id INTO v_id
    FROM   categories
    WHERE  type = p_type
    AND    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(p_parent,  '00000000-0000-0000-0000-000000000000'::uuid)
    AND    lower(name) = lower(p_name);

    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    INSERT INTO categories (id, name, description, parent_id, level, type, active, created_at)
    VALUES (p_id, p_name, p_description, p_parent, v_level, p_type, true, now())
    ON CONFLICT (id) DO NOTHING;

    RETURN p_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. CORRECTION D'ORTHOGRAPHE PREALABLE
-- ============================================================
-- « Equipements » (V024) et « Équipements » (nomenclature) designent la meme
-- categorie. Sans cette normalisation, la comparaison par libelle echouerait sur
-- l'accent et creerait un doublon a cote de la categorie qui porte deja les
-- terminaux.
UPDATE categories
SET    name = 'Équipements'
WHERE  type = 'PRODUCT'
AND    parent_id IS NULL
AND    name = 'Equipements';

-- ============================================================
-- 2. NOMENCLATURE
-- ============================================================
DO $$
DECLARE
    v_equipements   UUID;
    v_internet_mob  UUID;
    v_serv_fin      UUID;
    v_internet_fixe UUID;
BEGIN
    -- ---------- PRODUIT ----------
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000001',
        'Téléphones', 'Terminaux mobiles et smartphones', 'PRODUCT', NULL);

    v_equipements := pim_seed_category('d2000000-0000-0000-0000-000000000002',
        'Équipements', 'Terminaux, SIM et accessoires', 'PRODUCT', NULL);

    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000003',
        'Routeurs', 'Routeurs fixes et mobiles', 'PRODUCT', v_equipements);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000004',
        'Modems', 'Modems et cles Internet', 'PRODUCT', v_equipements);

    -- ---------- OFFRE ----------
    v_internet_mob := pim_seed_category('d2000000-0000-0000-0000-000000000011',
        'Internet mobile', 'Offres Internet sur le reseau mobile', 'OFFER', NULL);

    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000012',
        'Forfaits Data', 'Forfaits Internet mobile', 'OFFER', v_internet_mob);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000013',
        'Forfaits Voix', 'Forfaits d''appels nationaux et internationaux', 'OFFER', v_internet_mob);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000014',
        'Forfaits SMS', 'Forfaits de messages courts', 'OFFER', v_internet_mob);

    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000015',
        'Offres combinées', 'Offres associant data, voix et SMS', 'OFFER', NULL);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000016',
        'Offres prépayées', 'Offres a paiement anticipe', 'OFFER', NULL);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000017',
        'Offres postpayées', 'Offres a facturation differee', 'OFFER', NULL);

    -- ---------- SERVICE ----------
    v_serv_fin := pim_seed_category('d2000000-0000-0000-0000-000000000021',
        'Services financiers', 'Services financiers mobiles', 'SERVICE', NULL);

    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000022',
        'Moov Money', 'Porte-monnaie electronique Moov Money', 'SERVICE', v_serv_fin);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000023',
        'Transfert d''argent', 'Envoi et reception d''argent', 'SERVICE', v_serv_fin);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000024',
        'Paiement', 'Paiement marchand et factures', 'SERVICE', v_serv_fin);

    v_internet_fixe := pim_seed_category('d2000000-0000-0000-0000-000000000025',
        'Internet fixe', 'Acces Internet a domicile et en entreprise', 'SERVICE', NULL);

    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000026',
        'FTTH', 'Fibre optique jusqu''au domicile', 'SERVICE', v_internet_fixe);

    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000027',
        'Services à valeur ajoutée', 'Contenus et services complementaires', 'SERVICE', NULL);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000028',
        'Services internationaux', 'Roaming et communications internationales', 'SERVICE', NULL);
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000029',
        'Services entreprises', 'Offres et services destines aux entreprises', 'SERVICE', NULL);

    -- ---------- PACK ----------
    PERFORM pim_seed_category('d2000000-0000-0000-0000-000000000031',
        'Packs & Bundles', 'Assemblages de produits et de services', 'PACK', NULL);
END $$;

-- ============================================================
-- 3. BRANCHES HERITEES FAISANT DOUBLE EMPLOI
-- ============================================================
-- « Data », « Voix » et « Mobile Money » viennent du jeu de demonstration V024 et
-- recouvrent respectivement « Internet mobile » et « Services financiers ». Elles
-- ne sont mises hors service que si elles sont vides, elles et toute leur
-- descendance : une categorie qui porte encore des elements reste selectionnable,
-- sans quoi ces elements deviendraient impossibles a reclasser.
--
-- La mise hors service est logique et reversible depuis l'ecran Categories.
WITH branches_vides AS (
    SELECT racine.id
    FROM   categories racine
    WHERE  racine.parent_id IS NULL
    AND    racine.name IN ('Data', 'Voix', 'Mobile Money')
    AND    NOT EXISTS (
               SELECT 1
               FROM   catalog_items i
               JOIN   categories c ON c.id = i.category_id
               WHERE  c.id = racine.id OR c.parent_id = racine.id)
)
UPDATE categories
SET    active = false
WHERE  id IN (SELECT id FROM branches_vides)
   OR  parent_id IN (SELECT id FROM branches_vides);

DROP FUNCTION IF EXISTS pim_seed_category(UUID, TEXT, TEXT, TEXT, UUID);
