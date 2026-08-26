-- Classification commerciale : TYPE -> CATEGORIE -> SOUS-CATEGORIE -> ELEMENT.
--
-- La table categories ne portait que (name, parent_id, level) : rien n'indiquait
-- si « Forfaits Data » designait une branche d'offres ou d'equipements. Un routeur
-- pouvait donc etre range sous « Forfaits Data » sans que rien ne s'y oppose, ni
-- en base ni dans le service.
--
-- Cette migration rattache chaque categorie a un type et rend l'incoherence
-- structurellement impossible, y compris pour une ecriture directe en SQL :
--
--   * categories(id, type) devient unique, ce qui autorise des cles etrangeres
--     composites transportant le type en meme temps que la reference ;
--   * categories(parent_id, type) -> categories(id, type) : une sous-categorie
--     herite obligatoirement du type de sa categorie parente ;
--   * catalog_items(category_id, item_type) -> categories(id, type) : le
--     discriminant d'heritage sert directement de garde-fou, un PRODUCT ne peut
--     pointer qu'une categorie PRODUCT ;
--   * offers(category_id, category_type) -> categories(id, type), avec
--     category_type fige a 'OFFER' : une offre ne peut viser qu'une categorie
--     d'offres.
--
-- La mise hors service devient logique (colonne active) : des elements deja
-- classes referencent les categories, une suppression physique les laisserait
-- orphelins.

-- ============================================================
-- 1. NOUVELLES COLONNES
-- ============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS type   VARCHAR(20);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 2. REPRISE DE L'EXISTANT
-- ============================================================
-- Le type se deduit d'abord des elements deja rattaches : c'est la seule source
-- sure. Une categorie qui contient des services est une categorie de services,
-- quel que soit son libelle.
UPDATE categories c
SET    type = derive.item_type
FROM (
    SELECT category_id,
           item_type,
           ROW_NUMBER() OVER (PARTITION BY category_id
                              ORDER BY COUNT(*) DESC, item_type) AS rang
    FROM   catalog_items
    GROUP  BY category_id, item_type
) AS derive
WHERE  derive.category_id = c.id
AND    derive.rang = 1
AND    c.type IS NULL;

-- Puis propagation le long de l'arborescence, dans les deux sens : une categorie
-- vide dont les enfants portent des services est une categorie de services, et
-- reciproquement. Deux passes suffisent pour une arborescence a deux niveaux ;
-- la boucle en prevoit cinq par securite.
DO $$
DECLARE
    restant INT;
BEGIN
    FOR i IN 1..5 LOOP
        UPDATE categories enfant
        SET    type = parent.type
        FROM   categories parent
        WHERE  enfant.parent_id = parent.id
        AND    enfant.type IS NULL
        AND    parent.type IS NOT NULL;

        UPDATE categories parent
        SET    type = enfants.type
        FROM  (SELECT parent_id, MIN(type) AS type
               FROM   categories
               WHERE  parent_id IS NOT NULL AND type IS NOT NULL
               GROUP  BY parent_id) AS enfants
        WHERE  parent.id = enfants.parent_id
        AND    parent.type IS NULL;

        SELECT COUNT(*) INTO restant FROM categories WHERE type IS NULL;
        EXIT WHEN restant = 0;
    END LOOP;
END $$;

-- Les categories restantes ne contiennent rien, nulle part dans leur branche :
-- aucune donnee ne peut trancher, on se rabat sur le libelle. SERVICE est le
-- defaut, c'est le type le moins engageant : il n'implique ni composition ni
-- circuit de publication.
UPDATE categories
SET    type = CASE
    WHEN lower(name) LIKE '%pack%'    THEN 'PACK'
    WHEN lower(name) LIKE '%bundle%'  THEN 'PACK'
    WHEN lower(name) LIKE '%quipement%' THEN 'PRODUCT'
    WHEN lower(name) LIKE '%l%phone%' THEN 'PRODUCT'
    WHEN lower(name) LIKE '%routeur%' THEN 'PRODUCT'
    WHEN lower(name) LIKE '%modem%'   THEN 'PRODUCT'
    WHEN lower(name) LIKE '%terminal%' OR lower(name) LIKE '%terminaux%' THEN 'PRODUCT'
    WHEN lower(name) LIKE '%accessoire%' THEN 'PRODUCT'
    WHEN lower(name) LIKE '%forfait%' THEN 'OFFER'
    WHEN lower(name) LIKE '%pass %' OR lower(name) LIKE 'pass%' THEN 'OFFER'
    WHEN lower(name) LIKE '%offre%'   THEN 'OFFER'
    WHEN lower(name) IN ('data', 'voix', 'sms')                 THEN 'OFFER'
    WHEN lower(name) LIKE '%internet mobile%'                   THEN 'OFFER'
    WHEN lower(name) LIKE '%pay%'                               THEN 'OFFER'
    ELSE 'SERVICE'
END
WHERE type IS NULL;

-- Coherence parent/enfant avant la pose des contraintes. Une branche heritee d'un
-- etat anterieur pourrait melanger deux types ; on aligne l'enfant sur son parent,
-- sauf si des elements d'un autre type y sont deja ranges — dans ce cas la
-- migration doit echouer bruyamment plutot que deplacer des donnees en silence.
UPDATE categories enfant
SET    type = parent.type
FROM   categories parent
WHERE  enfant.parent_id = parent.id
AND    enfant.type <> parent.type
AND    NOT EXISTS (SELECT 1 FROM catalog_items i
                   WHERE i.category_id = enfant.id AND i.item_type <> parent.type);

DO $$
DECLARE
    incoherentes INT;
BEGIN
    SELECT COUNT(*) INTO incoherentes
    FROM   catalog_items i
    JOIN   categories   c ON c.id = i.category_id
    WHERE  i.item_type <> c.type;

    IF incoherentes > 0 THEN
        RAISE EXCEPTION 'V044 : % element(s) du catalogue sont ranges dans une categorie d''un autre type. Reclassez-les avant de rejouer la migration.', incoherentes;
    END IF;
END $$;

-- ============================================================
-- 3. CONTRAINTES SUR LES CATEGORIES
-- ============================================================
ALTER TABLE categories ALTER COLUMN type SET NOT NULL;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_check;
ALTER TABLE categories ADD  CONSTRAINT categories_type_check
    CHECK (type IN ('PRODUCT', 'OFFER', 'SERVICE', 'PACK'));

-- Deux niveaux, pas davantage : la classification attendue s'arrete a la
-- sous-categorie, et l'interface presente exactement deux listes en cascade.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_level_check;
ALTER TABLE categories ADD  CONSTRAINT categories_level_check
    CHECK (level BETWEEN 0 AND 1);

-- L'ancienne unicite (name, level) interdisait qu'un meme libelle existe sous deux
-- types differents. Or « Forfaits Data » a un sens cote OFFRE comme cote SERVICE
-- selon la branche : ce qui doit etre unique, c'est le libelle au sein d'une meme
-- fratrie.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_level_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_type_parent_name
    ON categories (type,
                   COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
                   lower(name));

-- Support des cles etrangeres composites ci-dessous.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS uq_categories_id_type;
ALTER TABLE categories ADD  CONSTRAINT uq_categories_id_type UNIQUE (id, type);

-- Une sous-categorie herite du type de son parent. La reference simple devient
-- redondante : la composite verifie l'existence du parent et son type.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS fk_categories_parent_same_type;
ALTER TABLE categories ADD  CONSTRAINT fk_categories_parent_same_type
    FOREIGN KEY (parent_id, type) REFERENCES categories (id, type);

CREATE INDEX IF NOT EXISTS idx_categories_type ON categories (type);

-- ============================================================
-- 4. BRIQUES DU CATALOGUE
-- ============================================================
-- item_type est deja le discriminant d'heritage JOINED ('PRODUCT', 'SERVICE',
-- 'PACK') : il sert tel quel de second membre de la cle etrangere.
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_category_id_fkey;
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS fk_catalog_items_category_type;
ALTER TABLE catalog_items ADD  CONSTRAINT fk_catalog_items_category_type
    FOREIGN KEY (category_id, item_type) REFERENCES categories (id, type);

-- ============================================================
-- 5. OFFRES
-- ============================================================
ALTER TABLE offers ADD COLUMN IF NOT EXISTS category_id UUID;

-- Colonne technique, jamais ecrite par l'application : elle fige le second membre
-- de la cle etrangere composite. C'est elle qui interdit qu'une offre pointe une
-- categorie de produits, sans qu'aucun declencheur soit necessaire.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS category_type VARCHAR(20) NOT NULL DEFAULT 'OFFER';

ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_category_type_check;
ALTER TABLE offers ADD  CONSTRAINT offers_category_type_check
    CHECK (category_type = 'OFFER');

ALTER TABLE offers DROP CONSTRAINT IF EXISTS fk_offers_category_type;
ALTER TABLE offers ADD  CONSTRAINT fk_offers_category_type
    FOREIGN KEY (category_id, category_type) REFERENCES categories (id, type);

CREATE INDEX IF NOT EXISTS idx_offers_category ON offers (category_id);

COMMENT ON COLUMN offers.category_id IS
    'Categorie ou sous-categorie de type OFFER. Nulle pour les offres anterieures a la classification.';
COMMENT ON COLUMN offers.category_type IS
    'Fige a OFFER. Second membre de la cle etrangere composite vers categories(id, type).';
