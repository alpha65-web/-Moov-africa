package com.moov.pim.lifecycle.api;

import com.moov.pim.lifecycle.api.dto.CreateOfferRequest;
import com.moov.pim.lifecycle.api.dto.EnrichOfferRequest;
import com.moov.pim.lifecycle.api.dto.OfferResponse;
import com.moov.pim.lifecycle.api.dto.StatusTransitionRequest;
import com.moov.pim.lifecycle.service.OfferService;
import com.moov.pim.permissions.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OfferControllerTest {

    @Mock private OfferService offerService;
    @InjectMocks private OfferController controller;

    @Test
    void create_shouldReturn201() {
        var request = mock(CreateOfferRequest.class);
        var response = mock(OfferResponse.class);
        when(offerService.create(request)).thenReturn(response);

        var result = controller.create(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void getById_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(OfferResponse.class);
        when(offerService.getById(id)).thenReturn(response);

        var result = controller.getById(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void enrich_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var request = mock(EnrichOfferRequest.class);
        var response = mock(OfferResponse.class);
        when(offerService.enrich(id, request)).thenReturn(response);

        var result = controller.enrich(id, request);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void transition_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var request = mock(StatusTransitionRequest.class);
        var response = mock(OfferResponse.class);
        when(offerService.transition(id, request)).thenReturn(response);

        var result = controller.transition(id, request);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void myOffers_shouldReturn200() {
        UUID userId = UUID.randomUUID();
        var principal = mock(CustomUserDetails.class);
        when(principal.getUserId()).thenReturn(userId);
        var pageable = PageRequest.of(0, 10);
        Page<OfferResponse> page = new PageImpl<>(List.of());
        when(offerService.listByUser(userId, pageable)).thenReturn(page);

        var result = controller.myOffers(principal, pageable);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }
}
