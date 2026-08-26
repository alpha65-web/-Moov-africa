-- Aligne les canaux des campagnes deja en ligne sur leur campagne.
--
-- ChannelStatus.SENT n'etait ecrit nulle part dans le code : le setter existait,
-- aucun appelant. Une campagne passait donc en PUBLISHED tandis que ses canaux
-- restaient indefiniment a PENDING, sent_at vide, et l'ecran Campagnes affichait
-- « Non diffuse » sur une campagne pourtant en ligne. L'interface contredisait
-- l'etat de la campagne.
--
-- CampaignService.publishScheduledCampaigns marque desormais les canaux au moment
-- de la mise en ligne. Cette migration reprend les campagnes publiees avant cette
-- correction : sans elle, elles resteraient un contre-exemple permanent a l'ecran.
--
-- Portee de SENT ici : la plateforme a mis le message a disposition du canal a
-- cette date. Ce n'est pas un accuse de reception d'operateur — le referentiel
-- n'est pas une passerelle SMS et n'en recoit aucun retour. Meme portee que le
-- statut SUCCESS des exports d'integration.
--
-- La date retenue est celle de la mise en ligne de la campagne, jamais now() :
-- dater d'aujourd'hui une diffusion d'hier serait inventer un fait.
-- COALESCE couvre le cas d'une campagne publiee sans published_at renseigne.
--
-- Les canaux en echec ne sont pas repris : seul l'etat d'attente evolue.

UPDATE campaign_channels ch
SET    status  = 'SENT',
       sent_at = COALESCE(c.published_at, c.scheduled_at, c.created_at)
FROM   campaigns c
WHERE  c.id = ch.campaign_id
AND    c.status IN ('PUBLISHED', 'COMPLETED')
AND    ch.status = 'PENDING';
