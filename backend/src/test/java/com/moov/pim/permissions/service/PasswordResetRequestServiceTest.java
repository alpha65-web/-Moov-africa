package com.moov.pim.permissions.service;

import com.moov.pim.permissions.api.dto.PasswordResetRequestResponse;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.PasswordResetRequest;
import com.moov.pim.permissions.domain.PasswordResetRequestStatus;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.PasswordResetRequestRepository;
import com.moov.pim.permissions.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetRequestServiceTest {

    @Mock private PasswordResetRequestRepository requestRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private PasswordResetRequestService service;

    private User activeUser;

    @BeforeEach
    void setUp() throws Exception {
        Role role = createRole(RoleName.CHEF_PRODUIT);
        activeUser = new User("edwige@moov-africa.bf", "$2a$10$hash", "Edwige", "Kabore", role);
        setId(activeUser, UUID.randomUUID());
    }

    @Test
    void submit_shouldRecordRequestForActiveAccount() {
        when(userRepository.findByEmail("edwige@moov-africa.bf")).thenReturn(Optional.of(activeUser));
        when(requestRepository.findByUserIdAndStatus(activeUser.getId(), PasswordResetRequestStatus.PENDING))
                .thenReturn(Optional.empty());

        service.submit("edwige@moov-africa.bf", "10.0.0.8");

        ArgumentCaptor<PasswordResetRequest> saved = ArgumentCaptor.forClass(PasswordResetRequest.class);
        verify(requestRepository).save(saved.capture());
        assertEquals(activeUser.getId(), saved.getValue().getUserId());
        assertEquals("10.0.0.8", saved.getValue().getRequesterIp());
        assertEquals(PasswordResetRequestStatus.PENDING, saved.getValue().getStatus());
    }

    @Test
    void submit_shouldTrimTheAddressBeforeLookup() {
        when(userRepository.findByEmail("edwige@moov-africa.bf")).thenReturn(Optional.of(activeUser));
        when(requestRepository.findByUserIdAndStatus(any(), any())).thenReturn(Optional.empty());

        service.submit("  edwige@moov-africa.bf  ", "10.0.0.8");

        verify(requestRepository).save(any());
    }

    /**
     * Une adresse inconnue ne doit rien changer et surtout rien reveler : le
     * controleur repond 202 dans tous les cas, l'ecran de connexion ne peut donc
     * pas servir a savoir qui possede un compte.
     */
    @Test
    void submit_shouldStaySilentOnUnknownAddress() {
        when(userRepository.findByEmail("inconnu@moov-africa.bf")).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> service.submit("inconnu@moov-africa.bf", "10.0.0.8"));

        verify(requestRepository, never()).save(any());
    }

    @Test
    void submit_shouldIgnoreDeactivatedAccount() {
        activeUser.setStatus(AccountStatus.DISABLED);
        when(userRepository.findByEmail("edwige@moov-africa.bf")).thenReturn(Optional.of(activeUser));

        service.submit("edwige@moov-africa.bf", "10.0.0.8");

        verify(requestRepository, never()).save(any());
    }

    /**
     * Recliquer sur le bouton ne doit pas empiler des lignes identiques dans la
     * file de l'administrateur.
     */
    @Test
    void submit_shouldNotDuplicateAPendingRequest() {
        when(userRepository.findByEmail("edwige@moov-africa.bf")).thenReturn(Optional.of(activeUser));
        when(requestRepository.findByUserIdAndStatus(activeUser.getId(), PasswordResetRequestStatus.PENDING))
                .thenReturn(Optional.of(new PasswordResetRequest(activeUser.getId(), "10.0.0.8")));

        service.submit("edwige@moov-africa.bf", "10.0.0.8");

        verify(requestRepository, never()).save(any());
    }

    @Test
    void pending_shouldJoinTheAccountIdentity() {
        PasswordResetRequest request = new PasswordResetRequest(activeUser.getId(), "10.0.0.8");
        when(requestRepository.findByStatusOrderByRequestedAtDesc(PasswordResetRequestStatus.PENDING))
                .thenReturn(List.of(request));
        when(userRepository.findAllById(List.of(activeUser.getId()))).thenReturn(List.of(activeUser));

        List<PasswordResetRequestResponse> file = service.pending();

        assertEquals(1, file.size());
        assertEquals("edwige@moov-africa.bf", file.get(0).email());
        assertEquals("Edwige", file.get(0).firstName());
        assertEquals(RoleName.CHEF_PRODUIT.name(), file.get(0).role());
        assertEquals(PasswordResetRequestStatus.PENDING.name(), file.get(0).status());
    }

    @Test
    void pending_shouldNotQueryUsersWhenTheFileIsEmpty() {
        when(requestRepository.findByStatusOrderByRequestedAtDesc(PasswordResetRequestStatus.PENDING))
                .thenReturn(List.of());

        assertTrue(service.pending().isEmpty());

        verify(userRepository, never()).findAllById(any());
    }

    @Test
    void closeAfterReset_shouldMarkThePendingRequestAsHandled() {
        UUID administrator = UUID.randomUUID();
        PasswordResetRequest request = new PasswordResetRequest(activeUser.getId(), "10.0.0.8");
        when(requestRepository.findByUserIdAndStatus(activeUser.getId(), PasswordResetRequestStatus.PENDING))
                .thenReturn(Optional.of(request));

        service.closeAfterReset(activeUser.getId(), administrator);

        assertEquals(PasswordResetRequestStatus.HANDLED, request.getStatus());
        assertEquals(administrator, request.getHandledBy());
        assertNotNull(request.getHandledAt());
        verify(requestRepository).save(request);
    }

    /**
     * Reposer le mot de passe d'un compte qui n'a rien demande est legitime :
     * l'absence de demande ne doit pas faire echouer la mise a jour du compte.
     */
    @Test
    void closeAfterReset_shouldDoNothingWithoutAPendingRequest() {
        when(requestRepository.findByUserIdAndStatus(activeUser.getId(), PasswordResetRequestStatus.PENDING))
                .thenReturn(Optional.empty());

        assertDoesNotThrow(() -> service.closeAfterReset(activeUser.getId(), UUID.randomUUID()));

        verify(requestRepository, never()).save(any());
    }

    @Test
    void cancel_shouldDismissAPendingRequest() {
        UUID administrator = UUID.randomUUID();
        PasswordResetRequest request = new PasswordResetRequest(activeUser.getId(), "10.0.0.8");
        UUID requestId = UUID.randomUUID();
        setId(request, requestId);
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));

        service.cancel(requestId, administrator);

        assertEquals(PasswordResetRequestStatus.CANCELLED, request.getStatus());
        assertEquals(administrator, request.getHandledBy());
        verify(requestRepository).save(request);
    }

    @Test
    void cancel_shouldRefuseAnAlreadyClosedRequest() {
        PasswordResetRequest request = new PasswordResetRequest(activeUser.getId(), "10.0.0.8");
        request.close(PasswordResetRequestStatus.HANDLED, UUID.randomUUID());
        UUID requestId = UUID.randomUUID();
        setId(request, requestId);
        when(requestRepository.findById(requestId)).thenReturn(Optional.of(request));

        assertThrows(IllegalArgumentException.class, () -> service.cancel(requestId, UUID.randomUUID()));

        verify(requestRepository, never()).save(any());
    }

    private static void setId(Object target, UUID id) {
        try {
            Field field = target.getClass().getDeclaredField("id");
            field.setAccessible(true);
            field.set(target, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Role createRole(RoleName roleName) throws Exception {
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
    }
}
