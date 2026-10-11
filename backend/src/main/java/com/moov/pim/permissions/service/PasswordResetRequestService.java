package com.moov.pim.permissions.service;

import com.moov.pim.permissions.api.dto.PasswordResetRequestResponse;
import com.moov.pim.permissions.domain.AccountStatus;
import com.moov.pim.permissions.domain.PasswordResetRequest;
import com.moov.pim.permissions.domain.PasswordResetRequestStatus;
import com.moov.pim.permissions.domain.User;
import com.moov.pim.permissions.repository.PasswordResetRequestRepository;
import com.moov.pim.permissions.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Circuit de l'oubli de mot de passe.
 *
 * La plateforme n'envoie aucun courriel : la demande deposee depuis l'ecran de
 * connexion est enregistree, l'administrateur la voit dans une file et repose un
 * mot de passe provisoire par le chemin habituel. Ce service ne fait que porter
 * la demande, il ne touche jamais a un mot de passe.
 */
@Service
public class PasswordResetRequestService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetRequestService.class);

    private final PasswordResetRequestRepository requestRepository;
    private final UserRepository userRepository;

    public PasswordResetRequestService(PasswordResetRequestRepository requestRepository,
                                       UserRepository userRepository) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
    }

    /**
     * Enregistre la demande d'une personne qui ne peut plus se connecter.
     *
     * L'appelant n'est pas authentifie : la methode ne dit jamais si l'adresse
     * correspond a un compte, sans quoi l'ecran de connexion deviendrait un moyen
     * de savoir qui travaille dans l'entreprise. Une adresse inconnue, un compte
     * desactive et une demande deja en attente donnent donc tous la meme reponse
     * au client, et seule la trace applicative distingue les cas.
     */
    @Transactional
    public void submit(String email, String requesterIp) {
        // Meme normalisation que la connexion, a l'espace superflu pres : une
        // adresse qui ouvre une session doit ouvrir une demande, et inversement.
        Optional<User> found = userRepository.findByEmail(email.trim());
        if (found.isEmpty()) {
            log.info("Demande de reinitialisation pour une adresse inconnue, ignoree");
            return;
        }

        User user = found.get();
        if (user.getStatus() != AccountStatus.ACTIVE) {
            log.info("Demande de reinitialisation sur un compte non actif ({}), ignoree", user.getStatus());
            return;
        }

        // L'index unique partiel garantit deja l'unicite en base ; ce controle
        // evite simplement de provoquer une violation de contrainte a chaque
        // reclic sur le bouton.
        if (requestRepository.findByUserIdAndStatus(user.getId(), PasswordResetRequestStatus.PENDING).isPresent()) {
            log.info("Demande de reinitialisation deja en attente pour ce compte, ignoree");
            return;
        }

        requestRepository.save(new PasswordResetRequest(user.getId(), requesterIp));
        log.info("Demande de reinitialisation enregistree pour le compte {}", user.getId());
    }

    /** File des demandes que l'administrateur n'a pas encore traitees. */
    @Transactional(readOnly = true)
    public List<PasswordResetRequestResponse> pending() {
        List<PasswordResetRequest> requests =
                requestRepository.findByStatusOrderByRequestedAtDesc(PasswordResetRequestStatus.PENDING);
        if (requests.isEmpty()) {
            return List.of();
        }

        Map<UUID, User> users = userRepository
                .findAllById(requests.stream().map(PasswordResetRequest::getUserId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return requests.stream()
                .filter(request -> users.containsKey(request.getUserId()))
                .map(request -> PasswordResetRequestResponse.from(request, users.get(request.getUserId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public long countPending() {
        return requestRepository.countByStatus(PasswordResetRequestStatus.PENDING);
    }

    /**
     * Ecarte une demande sans y donner suite, par exemple lorsqu'elle ne provient
     * manifestement pas du titulaire du compte.
     */
    @Transactional
    public void cancel(UUID requestId, UUID administratorId) {
        PasswordResetRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Demande introuvable"));
        if (request.getStatus() != PasswordResetRequestStatus.PENDING) {
            throw new IllegalArgumentException("Cette demande a déjà été traitée");
        }
        request.close(PasswordResetRequestStatus.CANCELLED, administratorId);
        requestRepository.save(request);
    }

    /**
     * Cloture la demande en attente d'un compte dont le mot de passe vient d'etre
     * repose.
     *
     * Appelee par la mise a jour d'un utilisateur : l'administrateur qui repose un
     * mot de passe a repondu a la demande par ce geste meme, et lui demander de
     * la marquer ensuite comme traitee ferait de la file une corvee que l'on
     * finirait par ne plus tenir a jour.
     */
    @Transactional
    public void closeAfterReset(UUID userId, UUID administratorId) {
        requestRepository.findByUserIdAndStatus(userId, PasswordResetRequestStatus.PENDING)
                .ifPresent(request -> {
                    request.close(PasswordResetRequestStatus.HANDLED, administratorId);
                    requestRepository.save(request);
                });
    }
}
