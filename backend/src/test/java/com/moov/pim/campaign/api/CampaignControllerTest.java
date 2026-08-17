package com.moov.pim.campaign.api;

import com.moov.pim.campaign.api.dto.CampaignResponse;
import com.moov.pim.campaign.api.dto.CreateCampaignRequest;
import com.moov.pim.campaign.service.CampaignService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CampaignControllerTest {

    @Mock private CampaignService campaignService;
    @InjectMocks private CampaignController controller;

    @Test
    void create_shouldReturn201() {
        var request = mock(CreateCampaignRequest.class);
        var response = mock(CampaignResponse.class);
        when(campaignService.create(request)).thenReturn(response);

        var result = controller.create(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void getById_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(CampaignResponse.class);
        when(campaignService.getById(id)).thenReturn(response);

        var result = controller.getById(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void byOffer_shouldReturn200() {
        UUID offerId = UUID.randomUUID();
        when(campaignService.listByOffer(offerId)).thenReturn(List.of());

        var result = controller.byOffer(offerId);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertTrue(result.getBody().isEmpty());
    }

    @Test
    void delete_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.delete(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(campaignService).delete(id);
    }

    @Test
    void cancel_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(CampaignResponse.class);
        when(campaignService.cancel(id)).thenReturn(response);

        var result = controller.cancel(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
    }
}
