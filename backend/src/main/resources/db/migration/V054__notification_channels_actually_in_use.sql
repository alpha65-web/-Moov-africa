-- Canaux de notification : ne garder que ce que la plateforme envoie vraiment.
--
-- La configuration des canaux (Parametres > Notifications) proposait un canal
-- EMAIL par type de notification. Aucun expediteur de courrier n'existe dans le
-- backend : ces interrupteurs ne commandaient rien, et une banniere invitait
-- meme a « activer les notifications email ». Le canal est retire plutot que
-- laisse en trompe-l'oeil.
--
-- Le canal IN_APP, lui, est desormais consulte a chaque envoi (NotificationService)
-- : un type desactive par l'administrateur n'est plus notifie. Pour que le
-- comportement par defaut reste « tout est notifie », chaque type possede une
-- ligne IN_APP, creee active si elle manquait.

DELETE FROM notification_configs WHERE channel <> 'IN_APP';

INSERT INTO notification_configs (id, type, channel, enabled)
SELECT gen_random_uuid(), t.type, 'IN_APP', true
FROM (VALUES
    ('ENRICHMENT_REQUIRED'), ('VALIDATION_REQUIRED'), ('STRATEGIC_VALIDATION'),
    ('OFFER_REJECTED'), ('OFFER_PUBLISHED'), ('OFFER_EXPIRING'), ('CAMPAIGN_READY')
) AS t(type)
WHERE NOT EXISTS (
    SELECT 1 FROM notification_configs c WHERE c.type = t.type AND c.channel = 'IN_APP'
);
