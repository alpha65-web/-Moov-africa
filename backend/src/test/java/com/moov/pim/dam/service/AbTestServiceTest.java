package com.moov.pim.dam.service;

import com.moov.pim.dam.api.dto.AbTestResponse;
import com.moov.pim.dam.api.dto.CreateAbTestRequest;
import com.moov.pim.dam.domain.AbTest;
import com.moov.pim.dam.domain.AbTestStatus;
import com.moov.pim.dam.repository.AbTestRepository;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AbTestServiceTest {

    @Mock private AbTestRepository abTestRepository;

    @InjectMocks private AbTestService abTestService;

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
    void create_shouldCreateAbTest() {
        UUID offerId = UUID.randomUUID();
        CreateAbTestRequest request = new CreateAbTestRequest(
                offerId, "Image produit A", "Image produit B", "taux_de_clic");

        when(abTestRepository.save(any(AbTest.class))).thenAnswer(inv -> {
            AbTest t = inv.getArgument(0);
            setField(AbTest.class, t, "id", UUID.randomUUID());
            return t;
        });

        AbTestResponse response = abTestService.create(request);

        assertNotNull(response);
        assertEquals("Image produit A", response.variantA());
        assertEquals("Image produit B", response.variantB());
        assertEquals("taux_de_clic", response.metric());
        assertEquals("DRAFT", response.status());
    }

    @Test
    void listByOffer_shouldReturnTests() {
        UUID offerId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.DRAFT);

        when(abTestRepository.findByOfferId(offerId)).thenReturn(List.of(test));

        List<AbTestResponse> results = abTestService.listByOffer(offerId);

        assertEquals(1, results.size());
    }

    @Test
    void getById_shouldReturnTest() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.RUNNING);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));

        AbTestResponse response = abTestService.getById(testId);

        assertEquals("RUNNING", response.status());
    }

    @Test
    void getById_shouldThrowIfNotFound() {
        UUID fakeId = UUID.randomUUID();
        when(abTestRepository.findById(fakeId)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> abTestService.getById(fakeId));
    }

    @Test
    void start_shouldSetRunningStatus() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.DRAFT);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));
        when(abTestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbTestResponse response = abTestService.start(testId);

        assertEquals("RUNNING", response.status());
    }

    @Test
    void start_shouldThrowIfNotDraft() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.RUNNING);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));

        assertThrows(IllegalStateException.class, () -> abTestService.start(testId));
    }

    @Test
    void complete_shouldSetCompletedWithWinner() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("Variant A", "Variant B", AbTestStatus.RUNNING);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));
        when(abTestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbTestResponse response = abTestService.complete(testId, "Variant A");

        assertEquals("COMPLETED", response.status());
        assertEquals("Variant A", response.winner());
    }

    @Test
    void complete_shouldThrowIfNotRunning() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.DRAFT);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));

        assertThrows(IllegalStateException.class, () -> abTestService.complete(testId, "A"));
    }

    @Test
    void complete_shouldThrowIfWinnerInvalid() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.RUNNING);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));

        assertThrows(IllegalArgumentException.class, () -> abTestService.complete(testId, "C"));
    }

    @Test
    void cancel_shouldSetCancelledStatus() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.RUNNING);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));
        when(abTestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbTestResponse response = abTestService.cancel(testId);

        assertEquals("CANCELLED", response.status());
    }

    @Test
    void cancel_shouldThrowIfCompleted() {
        UUID testId = UUID.randomUUID();
        AbTest test = createAbTest("A", "B", AbTestStatus.COMPLETED);
        setField(AbTest.class, test, "id", testId);

        when(abTestRepository.findById(testId)).thenReturn(Optional.of(test));

        assertThrows(IllegalStateException.class, () -> abTestService.cancel(testId));
    }

    private AbTest createAbTest(String variantA, String variantB, AbTestStatus status) {
        AbTest test = new AbTest();
        test.setOfferId(UUID.randomUUID());
        test.setVariantA(variantA);
        test.setVariantB(variantB);
        test.setMetric("conversion");
        test.setStatus(status);
        test.setCreatedById(userId);
        setField(AbTest.class, test, "id", UUID.randomUUID());
        return test;
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
            setField(Role.class, role, "name", roleName);
            setField(Role.class, role, "id", UUID.randomUUID());
            return role;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
