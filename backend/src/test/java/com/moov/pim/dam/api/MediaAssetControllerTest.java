package com.moov.pim.dam.api;

import com.moov.pim.dam.api.dto.MediaAssetResponse;
import com.moov.pim.dam.api.dto.MediaValidationRequest;
import com.moov.pim.dam.service.MediaAssetService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MediaAssetControllerTest {

    @Mock private MediaAssetService mediaAssetService;
    @InjectMocks private MediaAssetController controller;

    @Test
    void upload_shouldReturn201() {
        var file = mock(MultipartFile.class);
        var response = mock(MediaAssetResponse.class);
        when(mediaAssetService.upload(file)).thenReturn(response);

        var result = controller.upload(file);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals(response, result.getBody());
    }

    @Test
    void validate_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var request = mock(MediaValidationRequest.class);
        var response = mock(MediaAssetResponse.class);
        when(mediaAssetService.validate(id, request)).thenReturn(response);

        var result = controller.validate(id, request);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void listByOffer_shouldReturn200() {
        UUID offerId = UUID.randomUUID();
        when(mediaAssetService.listByOffer(offerId)).thenReturn(List.of());

        var result = controller.listByOffer(offerId);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void getById_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(MediaAssetResponse.class);
        when(mediaAssetService.getById(id)).thenReturn(response);

        var result = controller.getById(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void delete_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.delete(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(mediaAssetService).delete(id);
    }
}
