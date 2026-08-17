package com.moov.pim.rules.api;

import com.moov.pim.rules.api.dto.BusinessRuleRequest;
import com.moov.pim.rules.api.dto.BusinessRuleResponse;
import com.moov.pim.rules.domain.RuleType;
import com.moov.pim.rules.service.BusinessRuleService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BusinessRuleControllerTest {

    @Mock private BusinessRuleService ruleService;
    @InjectMocks private BusinessRuleController controller;

    @Test
    void create_shouldReturn201() {
        var request = mock(BusinessRuleRequest.class);
        var response = mock(BusinessRuleResponse.class);
        when(ruleService.create(request)).thenReturn(response);

        var result = controller.create(request);

        assertEquals(HttpStatus.CREATED, result.getStatusCode());
    }

    @Test
    void getById_shouldReturn200() {
        UUID id = UUID.randomUUID();
        var response = mock(BusinessRuleResponse.class);
        when(ruleService.getById(id)).thenReturn(response);

        var result = controller.getById(id);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void listByType_shouldReturn200() {
        when(ruleService.listByType(RuleType.COMPATIBILITY)).thenReturn(List.of());

        var result = controller.listByType(RuleType.COMPATIBILITY);

        assertEquals(HttpStatus.OK, result.getStatusCode());
    }

    @Test
    void activate_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.activate(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(ruleService).activate(id);
    }

    @Test
    void delete_shouldReturn204() {
        UUID id = UUID.randomUUID();

        var result = controller.delete(id);

        assertEquals(HttpStatus.NO_CONTENT, result.getStatusCode());
        verify(ruleService).delete(id);
    }
}
