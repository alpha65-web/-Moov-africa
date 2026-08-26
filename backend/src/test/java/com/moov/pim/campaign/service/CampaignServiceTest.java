package com.moov.pim.campaign.service;

import com.moov.pim.campaign.api.dto.CampaignResponse;
import com.moov.pim.campaign.api.dto.CreateCampaignRequest;
import com.moov.pim.campaign.domain.Campaign;
import com.moov.pim.campaign.domain.CampaignStatus;
import com.moov.pim.campaign.domain.ChannelType;
import com.moov.pim.campaign.repository.CampaignRepository;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CampaignServiceTest {

    @Mock private CampaignRepository campaignRepository;
    @Mock private com.moov.pim.lifecycle.repository.OfferRepository offerRepository;

    @InjectMocks private CampaignService campaignService;

    private UUID userId;

    @BeforeEach
    void setUp() throws Exception {
        userId = UUID.randomUUID();
        Role role = createRole(RoleName.CHEF_PRODUIT);
        User user = new User("chef@moov.bf", "$2a$hash", "Chef", "Produit", role);
        setField(User.class, user, "id", userId);

        CustomUserDetails details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void create_shouldReturnCampaignWithDraftStatus() {
        CreateCampaignRequest request = new CreateCampaignRequest(
                "Campagne Été", UUID.randomUUID(), null,
                List.of(new CreateCampaignRequest.ChannelConfig(ChannelType.FACEBOOK, "Promo été")));

        when(campaignRepository.save(any(Campaign.class))).thenAnswer(inv -> {
            Campaign c = inv.getArgument(0);
            setField(Campaign.class, c, "id", UUID.randomUUID());
            return c;
        });

        CampaignResponse response = campaignService.create(request);

        assertNotNull(response);
        assertEquals("Campagne Été", response.name());
        assertEquals("DRAFT", response.status());
        assertEquals(1, response.channels().size());
    }

    @Test
    void create_withScheduledAt_shouldSetScheduledStatus() {
        LocalDateTime scheduled = LocalDateTime.now().plusDays(7);
        CreateCampaignRequest request = new CreateCampaignRequest(
                "Campagne Planifiée", UUID.randomUUID(), scheduled,
                List.of(new CreateCampaignRequest.ChannelConfig(ChannelType.INSTAGRAM, "Message")));

        when(campaignRepository.save(any(Campaign.class))).thenAnswer(inv -> {
            Campaign c = inv.getArgument(0);
            setField(Campaign.class, c, "id", UUID.randomUUID());
            return c;
        });

        CampaignResponse response = campaignService.create(request);

        assertEquals("SCHEDULED", response.status());
    }

    @Test
    void listByOffer_shouldFilterByOwnershipForNonAdmin() {
        UUID offerId = UUID.randomUUID();
        Campaign owned = createCampaign("Ma campagne", userId);
        Campaign other = createCampaign("Autre campagne", UUID.randomUUID());

        when(campaignRepository.findByOfferId(offerId)).thenReturn(List.of(owned, other));

        List<CampaignResponse> results = campaignService.listByOffer(offerId);

        assertEquals(1, results.size());
        assertEquals("Ma campagne", results.get(0).name());
    }

    @Test
    void getById_shouldReturnCampaignIfOwner() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("Test", userId);
        setField(Campaign.class, campaign, "id", campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));

        CampaignResponse response = campaignService.getById(campaignId);

        assertEquals("Test", response.name());
    }

    @Test
    void getById_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(campaignRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> campaignService.getById(fakeId));
    }

    @Test
    void getById_shouldThrowAccessDeniedIfNotOwner() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("Pas à moi", UUID.randomUUID());
        setField(Campaign.class, campaign, "id", campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));

        assertThrows(AccessDeniedException.class, () -> campaignService.getById(campaignId));
    }

    @Test
    void update_shouldUpdateDraftCampaign() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("Ancien nom", userId);
        setField(Campaign.class, campaign, "id", campaignId);

        CreateCampaignRequest request = new CreateCampaignRequest(
                "Nouveau nom", UUID.randomUUID(), null,
                List.of(new CreateCampaignRequest.ChannelConfig(ChannelType.LINKEDIN, "Msg")));

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(campaignRepository.save(any(Campaign.class))).thenAnswer(inv -> inv.getArgument(0));

        CampaignResponse response = campaignService.update(campaignId, request);

        assertEquals("Nouveau nom", response.name());
        assertEquals("DRAFT", response.status());
    }

    @Test
    void update_shouldThrowIfPublished() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("Published", userId);
        campaign.setStatus(CampaignStatus.PUBLISHED);
        setField(Campaign.class, campaign, "id", campaignId);

        CreateCampaignRequest request = new CreateCampaignRequest(
                "Modif", UUID.randomUUID(), null,
                List.of(new CreateCampaignRequest.ChannelConfig(ChannelType.FACEBOOK, "Msg")));

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));

        assertThrows(IllegalStateException.class, () -> campaignService.update(campaignId, request));
    }

    @Test
    void delete_shouldDeleteDraftCampaign() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("À supprimer", userId);
        setField(Campaign.class, campaign, "id", campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));

        campaignService.delete(campaignId);

        verify(campaignRepository).delete(campaign);
    }

    @Test
    void delete_shouldThrowIfPublished() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("Publiée", userId);
        campaign.setStatus(CampaignStatus.PUBLISHED);
        setField(Campaign.class, campaign, "id", campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));

        assertThrows(IllegalStateException.class, () -> campaignService.delete(campaignId));
    }

    @Test
    void cancel_shouldSetCancelledStatus() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("Active", userId);
        campaign.setStatus(CampaignStatus.SCHEDULED);
        setField(Campaign.class, campaign, "id", campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CampaignResponse response = campaignService.cancel(campaignId);

        assertEquals("CANCELLED", response.status());
    }

    @Test
    void cancel_shouldThrowIfCompleted() {
        UUID campaignId = UUID.randomUUID();
        Campaign campaign = createCampaign("Terminée", userId);
        campaign.setStatus(CampaignStatus.COMPLETED);
        setField(Campaign.class, campaign, "id", campaignId);

        when(campaignRepository.findById(campaignId)).thenReturn(Optional.of(campaign));

        assertThrows(IllegalStateException.class, () -> campaignService.cancel(campaignId));
    }

    @Test
    void publishScheduledCampaigns_shouldPublishReadyCampaigns() {
        Campaign campaign = createCampaign("Planifiée", userId);
        campaign.setStatus(CampaignStatus.SCHEDULED);
        campaign.setScheduledAt(LocalDateTime.now().minusHours(1));

        when(campaignRepository.findByStatusAndScheduledAtBefore(eq(CampaignStatus.SCHEDULED), any()))
                .thenReturn(List.of(campaign));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        campaignService.publishScheduledCampaigns();

        assertEquals(CampaignStatus.PUBLISHED, campaign.getStatus());
        assertNotNull(campaign.getPublishedAt());
        verify(campaignRepository).save(campaign);
    }

    @Test
    void publishScheduledCampaigns_shouldMarkChannelsAsDistributed() {
        Campaign campaign = createCampaign("Planifiée", userId);
        campaign.setStatus(CampaignStatus.SCHEDULED);
        campaign.setScheduledAt(LocalDateTime.now().minusHours(1));

        com.moov.pim.campaign.domain.CampaignChannel sms =
                new com.moov.pim.campaign.domain.CampaignChannel();
        sms.setChannelType(com.moov.pim.campaign.domain.ChannelType.SMS);
        sms.setMessage("Message SMS");
        campaign.addChannel(sms);

        // Un canal deja en echec ne doit pas etre repris par la mise en ligne.
        com.moov.pim.campaign.domain.CampaignChannel email =
                new com.moov.pim.campaign.domain.CampaignChannel();
        email.setChannelType(com.moov.pim.campaign.domain.ChannelType.EMAIL);
        email.setMessage("Message courriel");
        email.setStatus(com.moov.pim.campaign.domain.ChannelStatus.FAILED);
        campaign.addChannel(email);

        when(campaignRepository.findByStatusAndScheduledAtBefore(eq(CampaignStatus.SCHEDULED), any()))
                .thenReturn(List.of(campaign));
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        campaignService.publishScheduledCampaigns();

        assertEquals(com.moov.pim.campaign.domain.ChannelStatus.SENT, sms.getStatus());
        assertNotNull(sms.getSentAt());
        assertEquals(campaign.getPublishedAt(), sms.getSentAt());

        assertEquals(com.moov.pim.campaign.domain.ChannelStatus.FAILED, email.getStatus());
        assertNull(email.getSentAt());
    }

    /** Offre au statut voulu, telle que la resoudra le service. */
    private void offerWithStatus(UUID offerId, com.moov.pim.lifecycle.domain.OfferStatus status) {
        com.moov.pim.lifecycle.domain.Offer offer = new com.moov.pim.lifecycle.domain.Offer();
        offer.setStatus(status);
        when(offerRepository.findById(offerId)).thenReturn(java.util.Optional.of(offer));
    }

    @Test
    void publishNow_shouldDistributeImmediately() {
        Campaign campaign = createCampaign("Immédiate", userId);
        com.moov.pim.campaign.domain.CampaignChannel sms =
                new com.moov.pim.campaign.domain.CampaignChannel();
        sms.setChannelType(com.moov.pim.campaign.domain.ChannelType.SMS);
        campaign.addChannel(sms);

        when(campaignRepository.findById(campaign.getId())).thenReturn(java.util.Optional.of(campaign));
        offerWithStatus(campaign.getOfferId(), com.moov.pim.lifecycle.domain.OfferStatus.PUBLISHED);
        when(campaignRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        campaignService.publishNow(campaign.getId());

        assertEquals(CampaignStatus.PUBLISHED, campaign.getStatus());
        assertNotNull(campaign.getPublishedAt());
        assertEquals(com.moov.pim.campaign.domain.ChannelStatus.SENT, sms.getStatus());
        assertEquals(campaign.getPublishedAt(), sms.getSentAt());
    }

    @Test
    void publishNow_shouldRefuseWhenOfferIsNotPublished() {
        Campaign campaign = createCampaign("Prématurée", userId);

        when(campaignRepository.findById(campaign.getId())).thenReturn(java.util.Optional.of(campaign));
        offerWithStatus(campaign.getOfferId(), com.moov.pim.lifecycle.domain.OfferStatus.DRAFT);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> campaignService.publishNow(campaign.getId()));
        assertTrue(ex.getMessage().contains("offre indisponible"));
        assertEquals(CampaignStatus.DRAFT, campaign.getStatus());
        verify(campaignRepository, never()).save(any());
    }

    @Test
    void publishNow_shouldRefuseWhenCampaignIsAlreadyPublished() {
        Campaign campaign = createCampaign("Déjà en ligne", userId);
        campaign.setStatus(CampaignStatus.PUBLISHED);

        when(campaignRepository.findById(campaign.getId())).thenReturn(java.util.Optional.of(campaign));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> campaignService.publishNow(campaign.getId()));
        assertTrue(ex.getMessage().contains("brouillon ou planifiée"));
    }

    private Campaign createCampaign(String name, UUID createdById) {
        Campaign campaign = new Campaign();
        campaign.setName(name);
        campaign.setOfferId(UUID.randomUUID());
        campaign.setCreatedById(createdById);
        setField(Campaign.class, campaign, "id", UUID.randomUUID());
        return campaign;
    }

    private static void setField(Class<?> clazz, Object target, String fieldName, Object value) {
        try {
            Field field = clazz.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static Role createRole(RoleName roleName) {
        try {
            var constructor = Role.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Role role = constructor.newInstance();
            Field nameField = Role.class.getDeclaredField("name");
            nameField.setAccessible(true);
            nameField.set(role, roleName);
            Field idField = Role.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(role, UUID.randomUUID());
            return role;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
