package com.moov.pim.permissions.api;

import com.moov.pim.permissions.api.dto.UpdateProfileRequest;
import com.moov.pim.permissions.api.dto.UpdateUserRequest;
import com.moov.pim.permissions.api.dto.UserResponse;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.Role;
import com.moov.pim.permissions.domain.RoleName;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.RoleRepository;
import com.moov.pim.permissions.repository.UserRepository;
import com.moov.pim.permissions.security.CustomUserDetails;
import com.moov.pim.permissions.security.PasswordPolicyService;
import com.moov.pim.permissions.service.AvatarValidator;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicyService passwordPolicyService;

    public UserController(UserRepository userRepository,
                          RoleRepository roleRepository,
                          PasswordEncoder passwordEncoder,
                          PasswordPolicyService passwordPolicyService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicyService = passwordPolicyService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.ok(UserResponse.from(principal.getUser()));
    }

    /**
     * Mise a jour de son propre profil : photo et coordonnees.
     *
     * La photo pouvait etre posee par l'administrateur a la creation du compte,
     * mais son titulaire ne pouvait ni la voir ni la changer : la page Profil ne
     * l'affichait pas et aucun endpoint ne lui etait ouvert. Le cahier des charges
     * (fonctionnalites, section 1) prevoit la gestion de son profil par chaque
     * utilisateur. Aucune permission particuliere : chacun n'agit que sur son
     * propre compte, designe par le jeton.
     */
    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateMe(@AuthenticationPrincipal CustomUserDetails principal,
                                                 @Valid @RequestBody UpdateProfileRequest request) {
        User user = userRepository.findById(principal.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (request.phone() != null) user.setPhone(blankToNull(request.phone()));
        if (request.pseudo() != null) user.setPseudo(blankToNull(request.pseudo()));
        if (request.address() != null) user.setAddress(blankToNull(request.address()));
        if (request.avatarUrl() != null) user.setAvatarUrl(AvatarValidator.normalize(request.avatarUrl()));

        user = userRepository.save(user);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<List<UserResponse>> list() {
        List<UserResponse> users = userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
        return ResponseEntity.ok(users);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<UserResponse> updateStatus(@PathVariable UUID id,
                                                     @RequestParam AccountStatus status,
                                                     @AuthenticationPrincipal CustomUserDetails principal) {
        if (principal.getUserId().equals(id)) {
            throw new IllegalArgumentException("Impossible de modifier votre propre statut");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        user.setStatus(status);
        if (status == AccountStatus.ACTIVE) {
            user.setFailedLoginAttempts(0);
        }
        user = userRepository.save(user);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<UserResponse> update(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (request.email() != null && !request.email().isBlank()
                && !request.email().equalsIgnoreCase(user.getEmail())) {
            if (userRepository.existsByEmail(request.email())) {
                throw new IllegalArgumentException("Un compte existe déjà avec cet email");
            }
            user.setEmail(request.email());
        }

        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setSex(blankToNull(request.sex()));
        user.setPhone(blankToNull(request.phone()));
        user.setPseudo(blankToNull(request.pseudo()));
        user.setAddress(blankToNull(request.address()));
        user.setAvatarUrl(AvatarValidator.normalize(request.avatarUrl()));

        // Reinitialisation du mot de passe par un administrateur : les sessions en
        // cours sont invalidees et l'utilisateur devra le changer a la reconnexion.
        if (request.password() != null && !request.password().isBlank()) {
            passwordPolicyService.validate(request.password());
            user.setPasswordHash(passwordEncoder.encode(request.password()));
            user.setForcePasswordChange(true);
            user.incrementTokenVersion();
        }

        if (request.roleName() != null) {
            RoleName roleName = RoleName.valueOf(request.roleName());
            Role role = roleRepository.findByName(roleName)
                    .orElseThrow(() -> new IllegalArgumentException("Rôle introuvable : " + request.roleName()));
            user.setRole(role);
        }

        user = userRepository.save(user);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                        @AuthenticationPrincipal CustomUserDetails principal) {
        if (principal.getUserId().equals(id)) {
            throw new IllegalArgumentException("Impossible de supprimer votre propre compte");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));
        userRepository.delete(user);
        return ResponseEntity.noContent().build();
    }
}
