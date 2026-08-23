-- Le jeu de donnees de demonstration V024 utilisait les statuts de campagne
-- (DRAFT / PUBLISHED) pour les canaux, alors que l'enum ChannelStatus ne connait
-- que PENDING, SENT et FAILED. Toute lecture des campagnes echouait en 400.
UPDATE campaign_channels SET status = 'SENT'    WHERE status = 'PUBLISHED';
UPDATE campaign_channels SET status = 'PENDING' WHERE status = 'DRAFT';
